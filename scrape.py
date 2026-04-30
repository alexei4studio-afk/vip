import asyncio
import argparse
import json
import os
import re
import sys
import hashlib
from datetime import datetime

from browser_use import Agent, Browser, ChatGroq
from dotenv import load_dotenv
from groq import Groq

sys.stdout.reconfigure(encoding='utf-8')
load_dotenv()

MODEL_NAME = "llama-3.3-70b-versatile"
NAPOLETANO_COMPETITORS = ["Massari", "Mamizza"]
DIRECT_TARGETS = ["magnolia.ro", "glovo.ro/pizzeria-massari", "glovo.ro/mamizza"]


def clean_json_response(content):
    if content.startswith("```json"):
        content = content.split("```json")[1]
    if content.startswith("```"):
        content = content.split("```")[1]
    if content.endswith("```"):
        content = content.rsplit("```", 1)[0]
    return content.strip() if isinstance(content, str) else ""


def invoke_strategy_groq(groq_client, prompt):
    response = groq_client.chat.completions.create(
        model=MODEL_NAME,
        temperature=0.2,
        messages=[
            {
                "role": "system",
                "content": "Raspunde strict JSON valid, fara markdown si fara text suplimentar.",
            },
            {"role": "user", "content": prompt},
        ],
    )
    return clean_json_response(response.choices[0].message.content)


def extract_price(raw_text):
    if not raw_text:
        return "N/A"
    match = re.search(r"(\d{1,3}(?:[.,]\d{1,2})?)\s*(?:RON|LEI|lei|ron)?", raw_text)
    return f"{match.group(1).replace(',', '.')} RON" if match else raw_text.strip()


def extract_competitor_rows(result_text):
    rows = []
    text = result_text or ""
    for competitor in NAPOLETANO_COMPETITORS:
        pattern = re.compile(
            rf"{competitor}.*?Margherita[:\s-]*(.*?)"
            rf"(?:Diavola[:\s-]*(.*?))?"
            rf"(?:Quattro\s*Formaggi[:\s-]*(.*?))?"
            rf"(?:Taxa(?:\s+de)?\s+livrare[:\s-]*(.*?))?(?:$|\n)",
            re.IGNORECASE | re.DOTALL,
        )
        match = pattern.search(text)
        if match:
            margherita = extract_price(match.group(1))
            diavola = extract_price(match.group(2) or "")
            quattro = extract_price(match.group(3) or "")
            taxa = extract_price(match.group(4) or "")
            rows.append(
                {
                    "platforma": "Glovo/Tazz",
                    "competitor": competitor,
                    "margherita": margherita if margherita else "N/A",
                    "diavola": diavola if diavola else "N/A",
                    "quattro_formaggi": quattro if quattro else "N/A",
                    "taxa_livrare": taxa if taxa else "N/A",
                }
            )
    return rows


def hardcoded_market_fallback_local(client, output_file):
    if os.path.exists(output_file):
        with open(output_file, "r", encoding="utf-8") as f:
            data = json.load(f)
            if isinstance(data, dict):
                return data

    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    return {
        "prices": [
            {
                "platforma": "Glovo",
                "competitor": "Massari",
                "margherita": "41 RON",
                "diavola": "45 RON",
                "quattro_formaggi": "47 RON",
                "taxa_livrare": "8 RON",
                "data": now,
            },
            {
                "platforma": "Tazz",
                "competitor": "Mamizza",
                "margherita": "48 RON",
                "diavola": "44 RON",
                "quattro_formaggi": "46 RON",
                "taxa_livrare": "10 RON",
                "data": now,
            }
        ],
        "analiza": {
            "pret_margherita_noi": "45 RON",
            "media_margherita_competitori": "44.5 RON",
            "cea_mai_ieftina_diavola": "Mamizza - 44 RON",
            "diferenta_diavola": "1 RON fata de Massari",
        },
        "strategii": [
            "Testeaza pret 44 RON la Margherita in orele cu trafic ridicat.",
            "Mentine Diavola competitiva in jurul pragului de 44-45 RON.",
            "Introdu bundle Pizza + Suc la 49-52 RON pentru a compensa taxele de livrare.",
        ],
        "fallback": True,
    }


def hardcoded_market_fallback_national(client, output_file):
    if os.path.exists(output_file):
        with open(output_file, "r", encoding="utf-8") as f:
            data = json.load(f)
            if isinstance(data, dict):
                return data

    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    return {
        "regiuni": [
            {
                "nume_sursa": "magnolia.ro",
                "pret_mediu_national": "45 RON",
                "stoc_status": "Disponibil",
                "timestamp": now,
            }
        ],
        "strategii": ["Date fallback active. Verifica din nou scraping-ul live."],
        "fallback": True,
    }


def write_json(path, payload):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, mode="w", encoding="utf-8") as file:
        json.dump(payload, file, indent=4, ensure_ascii=False)


def pause_for_manual_intervention(reason):
    print(f"[MANUAL] {reason}")
    print("[MANUAL] Browser rămâne deschis pentru intervenție manuală.")
    try:
        input("Apasă Enter după ce ai terminat intervenția manuală...")
    except EOFError:
        # Non-interactive environments should not crash the script.
        pass


async def process_manual_target(target_name, target_url, agent_llm, groq_client, browser):
    safe_name = re.sub(r"[^a-z0-9_]+", "_", target_name.lower()).strip("_") or "manual_target"
    url_hash = hashlib.md5(target_url.encode("utf-8")).hexdigest()[:8]
    output_file = f"public/data/manual_{safe_name}_{url_hash}.json"
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    task = f"""
    Deschide direct URL-ul: {target_url}
    Nu naviga către alte site-uri.
    Odată ce pagina este încărcată, extrage DOAR textul final util despre prețuri, taxe și disponibilitate.
    Returnează rezultat în text simplu (fără JSON, fără markdown).
    """

    try:
        agent = Agent(task=task, llm=agent_llm, browser=browser)
        history = await agent.run()
        result_text = (history.final_result() or "").strip()
        if not result_text:
            raise RuntimeError("Agentul nu a returnat text util.")
    except Exception as scraping_error:
        pause_for_manual_intervention(f"Eșec la target {target_url}: {scraping_error}")
        fallback = {
            "prices": [
                {
                    "platforma": target_url,
                    "competitor": target_name,
                    "margherita": "41-48 RON",
                    "diavola": "44-47 RON",
                    "quattro_formaggi": "45-49 RON",
                    "taxa_livrare": "8-12 RON",
                    "data": now,
                }
            ],
            "strategii": ["Fallback manual activ. Verifică pagina deschisă și relansează scraperul."],
            "fallback": True,
        }
        write_json(output_file, fallback)
        print(f"Salvat fallback manual în {output_file}")
        return

    strategy_prompt = f"""
    Ești expert în analiză competitivă.
    Țintă: {target_name} ({target_url})
    Text extras:
    {result_text}
    Returnează JSON valid strict:
    {{
      "prices": [
        {{
          "platforma": "sursa",
          "competitor": "nume",
          "margherita": "pret",
          "diavola": "pret",
          "quattro_formaggi": "pret",
          "taxa_livrare": "taxa",
          "data": "{now}"
        }}
      ],
      "strategii": [
        "Strategie 1",
        "Strategie 2"
      ]
    }}
    """
    try:
        strategy_content = invoke_strategy_groq(groq_client, strategy_prompt)
        payload = json.loads(strategy_content)
    except Exception as strategy_error:
        pause_for_manual_intervention(f"Eșec strategie pentru {target_url}: {strategy_error}")
        payload = {
            "prices": [
                {
                    "platforma": target_url,
                    "competitor": target_name,
                    "margherita": "41-48 RON",
                    "diavola": "44-47 RON",
                    "quattro_formaggi": "45-49 RON",
                    "taxa_livrare": "8-12 RON",
                    "data": now,
                }
            ],
            "strategii": ["Fallback manual activ după eșec strategie."],
            "fallback": True,
        }

    for row in payload.get("prices", []):
        row["data"] = row.get("data") or now
    write_json(output_file, payload)
    print(f"Salvat în {output_file}")


async def process_local_client(client, agent_llm, groq_client, browser):
    print(f"--- Procesare Client Local: {client['name']} ---")
    location = client.get("location", "Bucuresti")
    keywords = client.get("keywords", ["florarie"])
    keywords_str = ", ".join(keywords)
    platforme = client.get("platforme", ["glovo"])
    platforme_str = ", ".join(platforme)
    client_name_lower = client.get("name", "").lower()
    is_napoletano = client_name_lower == "napoletano"
    is_parada_florilor = client_name_lower == "parada florilor"

    filename_base = client.get("id", client["name"].lower().replace(" ", "_"))
    output_file = f"public/data/client_{filename_base.replace('client_', '')}.json"

    if is_napoletano:
        task = f"""
        Navigheaza pe platformele: {platforme_str}.
        Foloseste incarcare rapida (DOMContentLoaded) fara asteptare dupa media.
        Foloseste doar output text simplu, fara JSON, fara markdown.
        Cauta competitorii Massari si Mamizza si extrage:
        Margherita, Diavola, Quattro Formaggi, taxa livrare.
        Format fix pe fiecare linie:
        [Competitor] Margherita: X RON | Diavola: Y RON | Quattro Formaggi: Z RON | Taxa livrare: T RON
        """
    elif is_parada_florilor:
        task = f"""
        Navigheaza pe {platforme_str}, zona {location}.
        Foloseste incarcare rapida (DOMContentLoaded) fara asteptare dupa media.
        Cauta competitorul Magnolia.ro.
        Returneaza text simplu cu pret orientativ, taxa livrare, timp livrare.
        """
    else:
        task = f"""
        Navigheaza pe {platforme_str}, zona {location}.
        Foloseste incarcare rapida (DOMContentLoaded) fara asteptare dupa media.
        Cauta dupa: {keywords_str}.
        Returneaza text simplu cu competitor, pret, timp livrare.
        """

    try:
        agent = Agent(task=task, llm=agent_llm, browser=browser)
        history = await agent.run()
        result_text = (history.final_result() or "").strip()
        if not result_text:
            raise RuntimeError("Agentul nu a returnat text util.")
    except Exception as scraping_error:
        fallback_data = hardcoded_market_fallback_local(client, output_file)
        write_json(output_file, fallback_data)
        print(f"Scraping eșuat pentru {client['name']}. Fallback salvat în {output_file}: {scraping_error}")
        return

    rows = extract_competitor_rows(result_text) if is_napoletano else []

    if is_napoletano:
        strategy_prompt = f"""
        Ești expert în pricing pentru restaurante.
        Date brute extrase:
        {result_text}
        Date parse local:
        {json.dumps(rows, ensure_ascii=False)}
        Returnează JSON valid STRICT:
        {{
          "prices": [
            {{
              "platforma": "Glovo/Tazz",
              "competitor": "Massari/Mamizza",
              "margherita": "pret exact",
              "diavola": "pret exact",
              "quattro_formaggi": "pret exact",
              "taxa_livrare": "taxa livrare"
            }}
          ],
          "analiza": {{
            "pret_margherita_noi": "45 RON",
            "media_margherita_competitori": "valoare",
            "cea_mai_ieftina_diavola": "competitor + pret",
            "diferenta_diavola": "diferenta"
          }},
          "strategii": [
            "Strategie 1",
            "Strategie 2",
            "Strategie 3"
          ]
        }}
        """
    else:
        strategy_prompt = f"""
        Ești expert în strategie comercială locală.
        Iată datele extrase pentru '{client['name']}' în '{location}':
        {result_text}
        Returnează JSON valid strict:
        {{
          "prices": [
            {{"produs": "Nume competitor", "pret": "Preț mediu", "timp_livrare": "Timp livrare"}}
          ],
          "strategii": [
            "Strategia 1",
            "Strategia 2",
            "Strategia 3"
          ]
        }}
        """

    try:
        strategy_content = invoke_strategy_groq(groq_client, strategy_prompt)
    except Exception as strategy_error:
        fallback_data = hardcoded_market_fallback_local(client, output_file)
        write_json(output_file, fallback_data)
        print(f"Strategie AI eșuată pentru {client['name']}. Fallback salvat în {output_file}: {strategy_error}")
        return

    try:
        final_data = json.loads(strategy_content)
    except json.JSONDecodeError:
        if is_napoletano and rows:
            final_data = {
                "prices": rows,
                "strategii": ["Ajusteaza preturile incremental pe baza concurentei extrase."],
                "fallback": True,
            }
        else:
            final_data = hardcoded_market_fallback_local(client, output_file)

    if is_napoletano and rows and not final_data.get("prices"):
        final_data["prices"] = rows

    current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    for item in final_data.get("prices", []):
        item["data"] = current_time

    write_json(output_file, final_data)
    print(f"Salvat în {output_file}")


async def process_national_client(client, agent_llm, groq_client, browser):
    print(f"--- Procesare Client Național: {client['name']} ---")
    targets = DIRECT_TARGETS
    targets_str = ", ".join(targets)
    keywords = client.get("keywords", ["produs generic"])
    keywords_str = ", ".join(keywords)

    task = f"""
    Viziteaza direct: {targets_str}.
    Evita eMAG si Altex.
    Returneaza text simplu cu: nume sursa, pret mediu estimat, status stoc.
    """

    output_file = "public/data/national_business.json"
    try:
        agent = Agent(task=task, llm=agent_llm, browser=browser)
        history = await agent.run()
        result_text = (history.final_result() or "").strip()
        if not result_text:
            raise RuntimeError("Agentul nu a returnat text util.")
    except Exception as scraping_error:
        fallback_data = hardcoded_market_fallback_national(client, output_file)
        write_json(output_file, fallback_data)
        print(f"Scraping eșuat pentru {client['name']}. Fallback salvat în {output_file}: {scraping_error}")
        return

    strategy_prompt = f"""
    Ești expert în strategie națională.
    Analizează datele extrase de la sursele ({targets_str}) pentru '{keywords_str}':
    {result_text}
    Returneaza JSON valid strict:
    {{
      "regiuni": [
        {{"nume_sursa": "Numele site-ului", "pret_mediu_national": "Pret", "stoc_status": "Status"}}
      ],
      "lider_pret": "Numele liderului de preț",
      "media_pietei": "Valoarea medie a pieței",
      "strategii": [
        "Strategia 1",
        "Strategia 2"
      ]
    }}
    """

    try:
        strategy_content = invoke_strategy_groq(groq_client, strategy_prompt)
    except Exception as strategy_error:
        fallback_data = hardcoded_market_fallback_national(client, output_file)
        write_json(output_file, fallback_data)
        print(f"Strategie AI eșuată pentru {client['name']}. Fallback salvat în {output_file}: {strategy_error}")
        return

    try:
        final_data = json.loads(strategy_content)
    except json.JSONDecodeError:
        final_data = hardcoded_market_fallback_national(client, output_file)

    current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    for item in final_data.get("regiuni", []):
        item["timestamp"] = current_time

    write_json(output_file, final_data)
    print(f"Salvat în {output_file}")


async def run():
    parser = argparse.ArgumentParser()
    parser.add_argument("--target-url", dest="target_url", default=None)
    parser.add_argument("--target-name", dest="target_name", default="target_manual")
    parser.add_argument("--client-token", dest="client_token", default=None)
    args = parser.parse_args()

    config_path = "public/config.json"
    if not os.path.exists(config_path):
        print(f"Nu s-a găsit {config_path}")
        return

    with open(config_path, "r", encoding="utf-8") as f:
        config = json.load(f)

    groq_api_key = os.getenv("GROQ_API_KEY")
    if not groq_api_key:
        raise RuntimeError("Lipsește GROQ_API_KEY în variabilele de mediu.")

    # browser-use pe Groq, cu modelul cerut de tine
    agent_llm = ChatGroq(model=MODEL_NAME)
    groq_client = Groq(api_key=groq_api_key)
    browser = Browser(
        headless=False,
        args=[
            "--blink-settings=imagesEnabled=false",
            "--autoplay-policy=user-gesture-required",
            "--disable-features=PreloadMediaEngagementData,MediaEngagementBypassAutoplayPolicies",
        ],
        minimum_wait_page_load_time=0.2,
        wait_for_network_idle_page_load_time=0.0,
    )

    if args.target_url:
        await process_manual_target(args.target_name, args.target_url, agent_llm, groq_client, browser)
        await browser.stop()
        print("Rulare manuală finalizată.")
        return

    clients = config.get("clients", [])
    if args.client_token:
        clients = [c for c in clients if c.get("access_token") == args.client_token]
        if not clients:
            print(f"Nu am găsit client pentru token-ul furnizat.")
            await browser.stop()
            return

    CHUNK_SIZE = 3
    semaphore = asyncio.Semaphore(CHUNK_SIZE)

    async def process_single_client(client):
        async with semaphore:
            try:
                if client.get("type") == "local":
                    manual_sources = client.get("sources", [])
                    if isinstance(manual_sources, list) and manual_sources:
                        for source_url in manual_sources:
                            await process_manual_target(client.get("name", "client"), source_url, agent_llm, groq_client, browser)
                        return
                    await process_local_client(client, agent_llm, groq_client, browser)
                elif client.get("type") == "national":
                    await process_national_client(client, agent_llm, groq_client, browser)
            except Exception as e:
                print(f"Eroare la procesarea clientului {client.get('name')}: {e}")

    for i in range(0, len(clients), CHUNK_SIZE):
        chunk = clients[i : i + CHUNK_SIZE]
        print(f"--- Procesare lot {i // CHUNK_SIZE + 1}/{(len(clients) + CHUNK_SIZE - 1) // CHUNK_SIZE} ({len(chunk)} clienți) ---")
        await asyncio.gather(*(process_single_client(c) for c in chunk))

    await browser.stop()
    print("Toate sarcinile au fost finalizate.")


if __name__ == "__main__":
    asyncio.run(run())
