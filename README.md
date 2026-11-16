# flyWave

eVTOL operations platform for India: DGCA regulations & certification tracker, AI-assisted A→B flight planner (airspace avoidance, live weather, terrain, energy/reserve budget, ICAO FPL), and a three.js simulation lab for stress-testing custom eVTOL designs (specs or uploaded .glb).

Static site — no build step. Serve the folder, e.g. `python3 -m http.server 8080`, and open http://localhost:8080.

Data: weather & elevation from Open-Meteo, map tiles © OpenStreetMap. Regulatory content and airspace are indicative — verify with DGCA, AIP India and NOTAMs.
