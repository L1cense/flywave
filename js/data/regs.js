// Reference summary for study. Always verify against the current DGCA CARs, AIP India and eGCA.
export const REG_SECTIONS = [
{ id:'framework', title:'Regulatory framework', summary:'Who regulates eVTOL flight in India and under which laws.', items:[
  { title:'Bharatiya Vayuyan Adhiniyam, 2024', ref:'Act of Parliament (replaces Aircraft Act, 1934)', body:`
  <p>The primary civil aviation statute. It empowers the Central Government to make rules on design, manufacture, possession, use, operation, sale, import and export of aircraft, and establishes <b>DGCA</b> (safety regulator), <b>BCAS</b> (security) and <b>AAIB</b> (accident investigation).</p>
  <ul><li>Manned eVTOLs are <b>aircraft</b> (powered-lift / VTOL-capable) and fall under the Act and the Aircraft Rules, 1937.</li>
  <li>Unmanned eVTOLs up to 500 kg fall under the <b>Drone Rules, 2021</b>; heavier unmanned aircraft come under the Aircraft Rules.</li>
  <li>Contraventions can attract fines up to ₹1 crore and/or imprisonment (check the Act's penalty schedule).</li></ul>` , tags:['law','DGCA','BCAS','AAIB']},
  { title:'Aircraft Rules, 1937 & Civil Aviation Requirements (CARs)', ref:'DGCA', body:`
  <p>The Aircraft Rules give the legal requirements; DGCA <b>CARs</b> give the detailed technical standards. Key CAR sections for eVTOL operators:</p>
  <ul><li><b>Section 1</b> – General (incl. Safety Management System)</li><li><b>Section 2</b> – Airworthiness (CAR-21, CAR-M, CAR-145, CAR-66)</li>
  <li><b>Section 3</b> – Air Transport (Scheduled / Non-Scheduled operator permits)</li><li><b>Section 4</b> – Aerodrome standards &amp; licensing (heliports / vertiports)</li>
  <li><b>Section 5</b> – Air Safety (occurrence reporting, alcohol &amp; drug testing)</li><li><b>Section 7</b> – Flight Crew Standards (licensing, medical, FDTL)</li>
  <li><b>Section 8</b> – Aircraft Operations</li></ul>`, tags:['CAR','rules']},
  { title:'Agencies you will deal with', ref:'MoCA ecosystem', body:`
  <ul><li><b>MoCA</b> – Ministry of Civil Aviation: policy, UDAN/RCS connectivity, drone/AAM policy.</li>
  <li><b>DGCA</b> – certification, licensing, operator approvals, surveillance. Most applications run on the <b>eGCA</b> portal.</li>
  <li><b>AAI</b> – air navigation services: ATC, flight-plan filing, AIP, NOTAMs, airspace.</li>
  <li><b>BCAS</b> – aviation security programme, screening and vertiport security.</li>
  <li><b>AAIB</b> – accident &amp; serious incident investigation.</li>
  <li><b>IAF / Air Defence</b> – Air Defence Clearance (ADC) for flights in Indian ADIZ.</li>
  <li><b>WPC (DoT)</b> – aircraft radio station licence &amp; spectrum.</li></ul>`, tags:['agencies','eGCA','AAI']},
  { title:'Status of eVTOL-specific rules', ref:'Evolving — check latest DGCA circulars', body:`
  <p>India is building its Advanced Air Mobility framework. DGCA has published guidance on <b>vertiports</b> and is aligning eVTOL type certification with established international standards such as EASA <b>SC-VTOL</b> and FAA powered-lift rules, with validation of foreign certificates possible under bilateral arrangements.</p>
  <p>Where a specific eVTOL rule does not yet exist, DGCA normally applies the nearest existing requirements (helicopter / aeroplane CARs) plus <b>special conditions</b> for electric propulsion, high-voltage batteries and distributed lift.</p>`, tags:['eVTOL','SC-VTOL','AAM']},
]},
{ id:'aircraft', title:'Aircraft certification', summary:'Type certificate, airworthiness, registration and maintenance for the eVTOL itself.', items:[
  { title:'Type Certificate (TC) / TC validation', ref:'CAR-21', body:`
  <p>The design must be type-certificated by DGCA (Indian design) or a foreign TC must be <b>validated</b> by DGCA.</p>
  <ul><li>Applicant needs a <b>Design Organisation Approval (DOA)</b> or an accepted alternative procedure.</li>
  <li>Certification basis agreed with DGCA — for eVTOL typically based on EASA SC-VTOL with special conditions (battery thermal runaway, lift/thrust unit failure, flight control software).</li>
  <li>Commercial passenger operations normally require the "enhanced" category: continued safe flight &amp; landing after a single failure, catastrophic failure conditions extremely improbable (≈10⁻⁹ per flight hour).</li>
  <li>Means of compliance commonly used: DO-178C (software), DO-254 (hardware), DO-311A (rechargeable lithium batteries), DO-160 (environmental), ARP4754A/ARP4761 (system safety).</li></ul>`, tags:['TC','DOA','CAR-21']},
  { title:'Production Organisation Approval (POA)', ref:'CAR-21 Subpart G', body:`<p>Manufacturers of eVTOLs or major parts (motors, battery packs, rotors, flight computers) need a POA so each unit conforms to the approved type design and can be released with an authorised release certificate.</p>`, tags:['POA','manufacturing']},
  { title:'Certificate of Registration (CofR)', ref:'Aircraft Rules, 1937 — VT- marks', body:`<ul><li>Every Indian aircraft is registered with DGCA and carries <b>VT-</b> nationality marks.</li><li>Ownership / lease documents, import clearance (if imported) and security clearance from MHA may be required.</li><li>Apply on eGCA; the CofR must be carried on board.</li></ul>`, tags:['registration','VT']},
  { title:'Certificate of Airworthiness (CofA) & ARC', ref:'CAR Section 2', body:`<ul><li>CofA is issued after conformity inspection; it remains valid with an annual <b>Airworthiness Review Certificate (ARC)</b>.</li><li>Noise certificate and aircraft radio station licence (WPC) are carried on board.</li><li>Flight manual (AFM), MEL and weight &amp; balance schedule must be approved.</li></ul>`, tags:['CofA','ARC']},
  { title:'Continuing airworthiness & maintenance', ref:'CAR-M, CAR-145, CAR-66', body:`<ul><li><b>CAR-M</b> – continuing airworthiness management organisation (CAMO) and maintenance programme.</li><li><b>CAR-145</b> – approved maintenance organisations.</li><li><b>CAR-66</b> – Aircraft Maintenance Engineer (AME) licences; expect type training on high-voltage systems, battery handling and electric motors.</li><li>Track battery <b>State of Health</b>, cycle count and cell balancing as life-limited items.</li></ul>`, tags:['maintenance','AME','battery']},
]},
{ id:'operator', title:'Operator approvals', summary:'Permits to carry passengers or cargo commercially.', items:[
  { title:'Scheduled / Non-Scheduled Operator Permit', ref:'CAR Section 3 Series C', body:`<ul><li><b>Scheduled Operator Permit</b> – published timetables (Series C Part II).</li><li><b>Non-Scheduled Operator Permit (NSOP)</b> – charter / air-taxi (Series C Part III). Most early eVTOL air-taxi services are expected to use this route.</li><li>Process: MoCA NOC → security clearance → DGCA proving flights &amp; document evaluation → permit / Air Operator Certificate.</li><li>Required: Operations Manual, accountable manager and approved post-holders (Ops, Training, CAMO, Safety, Quality), minimum paid-up capital as notified.</li></ul>`, tags:['AOC','NSOP']},
  { title:'Safety Management System (SMS)', ref:'CAR Section 1 Series C Part I', body:`<p>Operators must run an SMS: hazard identification, risk assessment, safety performance indicators, safety assurance and promotion. For eVTOL include battery thermal events, vertiport congestion, low-altitude urban obstacles and bird activity.</p>`, tags:['SMS']},
  { title:'Flight Duty Time Limitations', ref:'CAR Section 7 Series J', body:`<p>FDTL limits flight time, duty periods and minimum rest for crew. Short-hop eVTOL sectors still count every landing; plan rosters with rest between waves of high-frequency operations.</p>`, tags:['FDTL','fatigue']},
  { title:'Security programme', ref:'BCAS', body:`<p>BCAS approves the operator and vertiport security programme: passenger &amp; baggage screening, access control, background checks (AEP) and staff security training.</p>`, tags:['BCAS','security']},
  { title:'Insurance & liability', ref:'Carriage by Air Act, 1972', body:`<ul><li>Passenger liability per the Carriage by Air Act (Montreal Convention limits for international, domestic rules for domestic carriage).</li><li>Third-party, hull and battery/charging-infrastructure insurance.</li><li>Passenger rights per CAR Section 3 Series M (refunds, denied boarding, accessibility).</li><li>Passenger personal data handled under the <b>DPDP Act, 2023</b>.</li></ul>`, tags:['insurance','liability']},
]},
{ id:'pilot', title:'Pilot licensing', summary:'Licences, ratings and currency for eVTOL pilots.', items:[
  { title:'Licence pathway', ref:'CAR Section 7 Series B', body:`<ul><li>Base licence: <b>CPL(A)</b> or <b>CPL(H)</b> (multicopter / lift-dominant designs are likely to be closer to helicopter licensing). Typical CPL(A) needs ~200 hrs total flight time.</li><li>Eligibility: age 18+, 10+2 with Physics &amp; Mathematics, Class 1 medical.</li><li><b>Powered-lift / eVTOL type rating</b> on the specific type (ground school, simulator, skill test).</li><li>DGCA ground exams via the online examination system; licence issued on eGCA (electronic personnel licence).</li></ul>`, tags:['CPL','type rating']},
  { title:'Radio & language', ref:'FRTOL, ICAO ELP', body:`<ul><li><b>FRTOL</b> – Flight Radio Telephone Operator's Licence (exam conducted by DGCA).</li><li>ICAO English Language Proficiency, Level 4 or higher.</li></ul>`, tags:['FRTOL','radio']},
  { title:'Recency & checks', ref:'CAR Section 7 / Ops Manual', body:`<ul><li>To carry passengers: at least <b>3 take-offs and landings in the preceding 90 days</b> on type (or approved simulator).</li><li>Pilot Proficiency Check (PPC) and line checks per the approved training programme (typically 6-monthly / annual).</li><li>Recurrent training: CRM, DGR (lithium batteries), emergency procedures (OEI, battery fire).</li><li>Instrument Rating required for IFR; early eVTOL ops are expected to be day VFR.</li></ul>`, tags:['recency','PPC']},
]},
{ id:'medical', title:'Medical & health', summary:'Medical fitness, validity and substance rules.', items:[
  { title:'Medical classes', ref:'CAR Section 7 Series C Part I', body:`<ul><li><b>Class 2</b> – needed to start training (student / private).</li><li><b>Class 1</b> – required for CPL and commercial eVTOL operations. Initial at a DGCA-approved examiner/board; renewals through DGCA-empanelled examiners, recorded on eGCA.</li><li>Standards cover vision (corrected 6/9 each eye), colour perception, hearing, cardiovascular (ECG), neurological, psychological and BMI.</li></ul>`, tags:['Class 1','Class 2']},
  { title:'Validity (ICAO-aligned)', ref:'CAR Section 7 Series C', body:`<table><tr><th>Medical</th><th>Under 40</th><th>40 and over</th></tr><tr><td>Class 1</td><td>12 months</td><td>12 months (6 months for single-pilot commercial passenger ops)</td></tr><tr><td>Class 2</td><td>60 months</td><td>24 months (12 months after 50)</td></tr></table><p class="small muted">Confirm current values on eGCA before planning.</p>`, tags:['validity']},
  { title:'Alcohol & psychoactive substances', ref:'CAR Section 5 Series F Part III', body:`<ul><li><b>Zero tolerance</b>: pre-flight breath-analyser testing for crew; a positive test leads to suspension.</li><li>Random psychoactive substance testing applies to safety-sensitive staff.</li><li>Do not fly within the prescribed period after any alcohol and avoid sedating medication; consult an aviation medical examiner.</li></ul>`, tags:['alcohol','BA test']},
  { title:'Fitness to fly — personal check', ref:'IMSAFE', body:`<ul><li><b>I</b>llness, <b>M</b>edication, <b>S</b>tress, <b>A</b>lcohol, <b>F</b>atigue, <b>E</b>motion / <b>E</b>ating.</li><li>Heat stress is a real risk in Indian summers — hydrate and plan for cockpit temperatures during ground time at vertiports.</li></ul>`, tags:['IMSAFE','fatigue']},
]},
{ id:'airspace', title:'Airspace & flight rules', summary:'Flight plans, clearances, VFR minima and restricted areas.', items:[
  { title:'Flight plan, FIC & ADC', ref:'AIP India ENR 1.10', body:`<ul><li>File an ICAO flight plan with AAI (ATS Reporting Office / online filing).</li><li>Flights in Indian airspace need a <b>Flight Information Centre (FIC)</b> number and an <b>Air Defence Clearance (ADC)</b> number — quote both on first contact with ATC.</li><li>Check <b>NOTAMs</b> and temporary restrictions (VIP movements, air shows, launches).</li></ul>`, tags:['FPL','FIC','ADC','NOTAM']},
  { title:'VFR minima', ref:'Rules of the Air / AIP ENR 1.2', body:`<ul><li>Visibility at or above <b>5 km</b>; ceiling not below <b>1500 ft</b> for VFR in a control zone.</li><li>Below 3000 ft AMSL in uncontrolled airspace: clear of cloud and in sight of the surface.</li><li>Day VFR only unless night ops are approved.</li></ul>`, tags:['VFR','weather']},
  { title:'Minimum heights', ref:'Rules of the Air', body:`<ul><li>Over congested areas: <b>1000 ft</b> above the highest obstacle within 600 m.</li><li>Elsewhere: <b>500 ft</b> above ground or water.</li><li>Except during take-off and landing at an approved vertiport / heliport.</li></ul>`, tags:['minimum altitude']},
  { title:'Prohibited, restricted & danger areas', ref:'AIP India ENR 5.1', body:`<ul><li>Prohibited areas (P) over sensitive sites — flight is not permitted.</li><li>Restricted (R) and danger (D) areas — need permission from the controlling authority or are active at notified times.</li><li>Military aerodromes have their own control zones.</li><li>Air Defence Identification Zones (ADIZ) cover Indian airspace — unidentified aircraft may be intercepted.</li></ul>`, tags:['prohibited','ADIZ']},
  { title:'Controlled airports & communication', ref:'AIP India', body:`<ul><li>Entering a CTR needs ATC clearance; maintain two-way RT on the published frequency.</li><li>Transponder (Mode S) squawk as assigned. Emergency codes: <b>7700</b> emergency, <b>7600</b> radio failure, <b>7500</b> unlawful interference.</li><li>Mumbai, Delhi and Bengaluru have dense helicopter traffic — expect published low-level routes.</li></ul>`, tags:['ATC','transponder']},
]},
{ id:'vertiport', title:'Vertiports & charging', summary:'Infrastructure approvals for take-off, landing and charging sites.', items:[
  { title:'Vertiport design & licensing', ref:'DGCA vertiport guidance / CAR Section 4', body:`<ul><li>FATO (final approach &amp; take-off area), TLOF (touchdown &amp; lift-off area) and safety area sized to the design aircraft (D-value).</li><li>Obstacle limitation surfaces and approach/departure paths clear of obstacles.</li><li>Lighting, wind indicator, markings, rescue &amp; fire-fighting (with lithium-battery fire capability).</li><li>Aerodrome / heliport licence from DGCA plus local building, land-use and fire NOCs.</li></ul>`, tags:['vertiport','FATO','TLOF']},
  { title:'Charging & electrical safety', ref:'CEA Regulations, BIS standards', body:`<ul><li>High-power DC charging installed per Central Electricity Authority safety regulations; earthing and isolation procedures.</li><li>Thermal monitoring of packs during charging; quarantine area for damaged batteries.</li><li>Battery end-of-life per the <b>Battery Waste Management Rules, 2022</b> (extended producer responsibility).</li></ul>`, tags:['charging','battery']},
]},
{ id:'drone', title:'Unmanned / cargo eVTOL', summary:'Drone Rules 2021 for autonomous or remotely piloted eVTOLs up to 500 kg.', items:[
  { title:'Drone Rules, 2021 (as amended)', ref:'MoCA', body:`<ul><li>Categories: nano &lt;250 g, micro 250 g–2 kg, small 2–25 kg, medium 25–150 kg, large 150–500 kg.</li><li><b>Type Certificate</b> via QCI-authorised certification bodies; each drone gets a <b>Unique Identification Number (UIN)</b> on Digital Sky.</li><li><b>Remote Pilot Certificate</b> from a DGCA-authorised RPTO (except nano / non-commercial micro).</li><li>Third-party insurance is mandatory for commercial ops.</li></ul>`, tags:['drone','UIN','RPC']},
  { title:'Airspace map — green / yellow / red', ref:'Digital Sky', body:`<ul><li><b>Green</b>: up to 400 ft AGL, no permission needed (check before every flight).</li><li><b>Yellow</b>: controlled airspace (e.g. 8–12 km from an airport perimeter) — ATC permission.</li><li><b>Red</b>: no-fly zone — Central Government permission only.</li></ul>`, tags:['Digital Sky','zones']},
]},
{ id:'safety', title:'Safety & reporting', summary:'What to do when things go wrong.', items:[
  { title:'Occurrence reporting', ref:'CAR Section 5 Series C', body:`<ul><li>Report accidents, serious incidents and incidents to DGCA within the notified timeline; accidents/serious incidents also to <b>AAIB</b> under the Aircraft (Investigation of Accidents and Incidents) Rules, 2017.</li><li>Battery thermal events, lift-unit failures and loss of command link should be in the operator's mandatory reporting list.</li><li>Use voluntary confidential reporting for hazards.</li></ul>`, tags:['MOR','AAIB']},
  { title:'Dangerous goods', ref:'Aircraft (Carriage of Dangerous Goods) Rules, 2003', body:`<p>Spare lithium batteries and passenger power banks are dangerous goods — follow ICAO Technical Instructions; train staff on DGR.</p>`, tags:['DGR','lithium']},
]},
];

export const TRACKS = [
  { id:'pilot', title:'Pilot', items:[
    ['Class 2 medical', 'DGCA-empanelled examiner; recorded on eGCA'],
    ['eGCA registration & Computer Number', 'Create profile, upload 10+2 and ID'],
    ['DGCA ground exams', 'Air Regulations, Navigation, Meteorology, Technical, RTR'],
    ['Class 1 medical', 'Initial assessment at an approved board/examiner'],
    ['CPL(A) / CPL(H) flight training', 'At a DGCA-approved FTO'],
    ['FRTOL', 'Radio telephony licence'],
    ['ICAO English Level 4+', 'Language proficiency assessment'],
    ['eVTOL type rating', 'Ground school, FSTD sessions, skill test'],
    ['Recency on type', '3 take-offs & landings in 90 days'],
    ['Breath analyser compliance briefing', 'CAR Section 5 Series F Part III'],
  ]},
  { id:'aircraft', title:'Aircraft', items:[
    ['Certification basis agreed with DGCA', 'SC-VTOL style + special conditions'],
    ['Type Certificate / validation', 'CAR-21'],
    ['Production approval / conformity', 'POA or import conformity'],
    ['Certificate of Registration (VT-)', 'eGCA application'],
    ['Certificate of Airworthiness + ARC', 'CAR Section 2'],
    ['Aircraft radio station licence', 'WPC, DoT'],
    ['Approved maintenance programme', 'CAR-M / CAMO'],
    ['Battery SoH monitoring plan', 'Life-limited item tracking'],
  ]},
  { id:'operator', title:'Operator', items:[
    ['MoCA NOC', 'Initial approval for NSOP/SOP'],
    ['Security clearance', 'Company & directors (MHA)'],
    ['Operations Manual', 'Incl. energy reserve policy'],
    ['SMS manual & safety officer', 'CAR Section 1 Series C'],
    ['BCAS security programme', 'Screening & access control'],
    ['Insurance', 'Passenger, third-party, hull'],
    ['Proving flights & DGCA audit', 'Final step before AOC'],
    ['Air Operator Permit issued', 'NSOP / SOP'],
  ]},
  { id:'vertiport', title:'Vertiport', items:[
    ['Site obstacle survey', 'Approach/departure surfaces'],
    ['FATO / TLOF design', 'Per DGCA vertiport guidance'],
    ['Charging installation approval', 'CEA safety regulations'],
    ['Fire NOC incl. Li-ion fire plan', 'State fire services'],
    ['Municipal & land-use approvals', 'Local bodies'],
    ['DGCA licence / approval', 'CAR Section 4'],
  ]},
];

export const GUIDE = [
  { phase:'Pre-flight', steps:['Check NOTAMs, FIC/ADC numbers and filed flight plan','Weather: visibility ≥ 5 km, winds within AFM limits, no thunderstorms on route','Battery: SoC for trip + reserve, cell temperature 15–35 °C, balancing OK, SoH ≥ 80%','Walk-around: rotor blades, motor mounts, HV connectors, control surfaces','Weight & balance within envelope; passenger briefing incl. battery-fire egress','IMSAFE self-check and breath-analyser test'] },
  { phase:'Take-off & transition', steps:['Obtain clearance; confirm FATO clear','Vertical climb to transition height (~30–50 m AGL) clear of obstacles','Monitor thrust margin and motor temperatures','Transition to wing-borne flight per AFM speed schedule; avoid rapid pitch changes'] },
  { phase:'Cruise', steps:['Maintain ≥ 1000 ft over congested areas (500 ft elsewhere)','Track energy: compare actual vs planned SoC at each waypoint','Keep a diversion vertiport within remaining range at all times','Report position at compulsory reporting points'] },
  { phase:'Approach & landing', steps:['Brief approach path, wind and go-around','Decelerate and convert to thrust-borne flight with margin','Stabilised vertical descent ≤ 1.5 m/s near touchdown','Shut down, isolate HV, log SoC and battery temperatures'] },
  { phase:'Emergencies', steps:['Lift/thrust unit failure: stabilise, reduce speed, land at nearest suitable site','Battery thermal runaway: land immediately, isolate pack, evacuate upwind','Loss of comms: squawk 7600, follow lost-comm procedures','Low energy: declare PAN/MAYDAY early, divert — do not stretch range'] },
];

export const INDIA_WX = [
  { months:[5,6,7,8], name:'South-west monsoon', note:'Heavy rain, low ceilings, embedded thunderstorms on the west coast and central India. Expect reduced battery efficiency from rain and gust loads.' },
  { months:[9,10], name:'Monsoon withdrawal / NE monsoon', note:'Tamil Nadu and coastal Andhra get heavy rain; Bay of Bengal cyclones possible.' },
  { months:[11,0,1], name:'Winter fog', note:'Dense radiation fog over the Indo-Gangetic plain (Delhi, Lucknow) — visibility often below VFR minima in the morning.' },
  { months:[2,3,4], name:'Pre-monsoon heat', note:'High temperatures raise density altitude and battery temperature; dust storms (andhi) in North India and nor\'westers in the East.' },
];
