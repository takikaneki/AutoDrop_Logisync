// Official 13 PSA Barangays of Trece Martires City, Cavite (named after the Thirteen Martyrs of Cavite)
export const TRECE_MARTIRES_CITY = "Trece Martires City";
export const CAVITE_PROVINCE = "Cavite";

export const TRECE_MARTIRES_BARANGAYS = [
  "Aguado",
  "Cabezas",
  "Cabuco",
  "Conchu",
  "De Ocampo",
  "Gregorio",
  "Hugo Perez",
  "Inocencio",
  "Lallana",
  "Lapidario",
  "Luciano",
  "Osorio",
  "San Agustin",
];

/**
 * Searches exclusively within Trece Martires City barangays.
 */
export function searchTreceBarangays(query) {
  const cleanQ = cleanBarangayPrefix(query || "");
  const q = normalizeText(cleanQ);
  if (!q) return TRECE_MARTIRES_BARANGAYS;

  return TRECE_MARTIRES_BARANGAYS.filter((b) => {
    const bNorm = normalizeText(b);
    if (bNorm.includes(q)) return true;
    if (q === "perez" && bNorm.includes("hugo perez")) return true;
    if (q === "gregoria" && bNorm.includes("gregorio")) return true;
    return false;
  }).sort((a, b) => {
    const aStarts = normalizeText(a).startsWith(q) ? 0 : 1;
    const bStarts = normalizeText(b).startsWith(q) ? 0 : 1;
    return aStarts - bStarts || a.localeCompare(b);
  });
}

export const PH_PROVINCES = [
  "Abra", "Agusan del Norte", "Agusan del Sur", "Aklan", "Albay", "Antique", "Apayao",
  "Aurora", "Basilan", "Bataan", "Batanes", "Batangas", "Benguet", "Biliran", "Bohol",
  "Bukidnon", "Bulacan", "Cagayan", "Camarines Norte", "Camarines Sur", "Camiguin",
  "Capiz", "Catanduanes", "Cavite", "Cebu", "Cotabato", "Davao de Oro", "Davao del Norte",
  "Davao del Sur", "Davao Occidental", "Davao Oriental", "Dinagat Islands", "Eastern Samar",
  "Guimaras", "Ifugao", "Ilocos Norte", "Ilocos Sur", "Iloilo", "Isabela", "Kalinga",
  "La Union", "Laguna", "Lanao del Norte", "Lanao del Sur", "Leyte", "Maguindanao del Norte",
  "Maguindanao del Sur", "Marinduque", "Masbate", "Metro Manila (NCR)", "Misamis Occidental",
  "Misamis Oriental", "Mountain Province", "Negros Occidental", "Negros Oriental",
  "Northern Samar", "Nueva Ecija", "Nueva Vizcaya", "Occidental Mindoro", "Oriental Mindoro",
  "Palawan", "Pampanga", "Pangasinan", "Quezon", "Quirino", "Rizal", "Romblon", "Samar",
  "Sarangani", "Siquijor", "Sorsogon", "South Cotabato", "Southern Leyte", "Sultan Kudarat",
  "Sulu", "Surigao del Norte", "Surigao del Sur", "Tarlac", "Tawi-Tawi", "Zambales",
  "Zamboanga del Norte", "Zamboanga del Sur", "Zamboanga Sibugay"
];

export const PH_CITIES_BY_PROVINCE = {
  "Cavite": [
    "Dasmariñas", "Imus", "Bacoor", "General Trias", "Silang", "Carmona",
    "Trece Martires", "Kawit", "Tanza", "Tagaytay", "Rosario", "Noveleta",
    "Cavite City", "Naic", "Alfonso", "Amadeo", "Indang", "Magallanes",
    "Maragondon", "Mendez", "Ternate", "General Emilio Aguinaldo"
  ],
  "Metro Manila (NCR)": [
    "Caloocan", "Las Piñas", "Makati", "Malabon", "Mandaluyong", "Manila",
    "Marikina", "Muntinlupa", "Navotas", "Parañaque", "Pasay", "Pasig",
    "Pateros", "Quezon City", "San Juan", "Taguig", "Valenzuela"
  ],
  "Laguna": [
    "Biñan", "Cabuyao", "Calamba", "San Pedro", "Santa Rosa", "Los Baños",
    "San Pablo", "Santa Cruz", "Bay", "Pagsanjan", "Calauan", "Liliw",
    "Nagcarlan", "Alaminos", "Siniloan", "Victoria"
  ],
  "Rizal": [
    "Antipolo", "Angono", "Binangonan", "Cainta", "Cardona", "Jalajala",
    "Morong", "Pililla", "Rodriguez (Montalban)", "San Mateo", "Tanay",
    "Taytay", "Teresa"
  ],
  "Batangas": [
    "Batangas City", "Lipa", "Tanauan", "Sto. Tomas", "Nasugbu", "Bauan",
    "Balayan", "Calaca", "Lemery", "Rosario", "San Juan", "Taal"
  ],
  "Bulacan": [
    "San Jose del Monte", "Malolos", "Meycauayan", "Marilao", "Santa Maria",
    "Baliuag", "Bocaue", "Plaridel", "Guiguinto", "Hagonoy", "Calumpit"
  ],
  "Pampanga": [
    "Angeles City", "San Fernando", "Mabalacat", "Guagua", "Lubao", "Mexico",
    "Arayat", "Candaba", "Floridablanca", "Porac"
  ],
  "Cebu": [
    "Cebu City", "Mandaue", "Lapu-Lapu", "Talisay", "Toledo", "Danao",
    "Naga", "Carcar", "Consolacion", "Liloan", "Minglanilla"
  ],
  "Davao del Sur": [
    "Davao City", "Digos", "Bansalan", "Hagonoy", "Matanao", "Padada",
    "Santa Cruz", "Sulop"
  ]
};

// Official PSA Barangays for Key Logistics Hubs & Operational Areas
export const PH_BARANGAYS_BY_CITY = {
  // Dasmariñas, Cavite (Official 75 Barangays)
  "dasmarinas": [
    "Burol", "Burol I", "Burol II", "Burol III", "Burol Main",
    "Salitran I", "Salitran II", "Salitran III", "Salitran IV",
    "Paliparan I", "Paliparan II", "Paliparan III",
    "Salawag", "Langkaan I", "Langkaan II",
    "Sampaloc I", "Sampaloc II", "Sampaloc III", "Sampaloc IV", "Sampaloc V",
    "San Agustin I", "San Agustin II", "San Agustin III",
    "San Andres I", "San Andres II",
    "San Antonio De Padua I", "San Antonio De Padua II",
    "San Dionisio", "San Esteban", "San Francisco I", "San Francisco II",
    "San Isidro Labrador I", "San Isidro Labrador II",
    "San Jose", "San Juan",
    "San Lorenzo Ruiz I", "San Lorenzo Ruiz II",
    "San Luis I", "San Luis II",
    "San Manuel I", "San Manuel II",
    "San Mateo", "San Miguel", "San Miguel II",
    "San Nicolas I", "San Nicolas II",
    "San Pedro I", "San Pedro II",
    "San Roque", "San Simon",
    "Santa Cristina I", "Santa Cristina II",
    "Santa Cruz I", "Santa Cruz II",
    "Santa Fe", "Santa Lucia", "Santa Maria",
    "Santo Cristo", "Santo Niño I", "Santo Niño II",
    "Victoria Reyes", "Zone I", "Zone I-B", "Zone II", "Zone III", "Zone IV",
    "Fatima I", "Fatima II", "Fatima III",
    "H-2", "Luzviminda I", "Luzviminda II", "Sabang", "Pag-Asa"
  ],

  // General Trias, Cavite
  "general trias": [
    "Manggahan", "San Francisco", "Pasong Kawayan I", "Pasong Kawayan II",
    "Tejero", "Bacao I", "Bacao II", "San Gabriel", "Pasong Camachile I",
    "Pasong Camachile II", "Arnaldo Pob.", "Santiago", "Santa Clara",
    "Navarro", "Pinagtipunan", "Prinza", "Bagumbayan Pob.", "Corregidor Pob.",
    "Dulong Bayan Pob.", "Gov. Ferrer Pob.", "Javalera", "Panungyanan",
    "San Juan I", "San Juan II", "Tapia", "Vibora", "Buenavista I", "Buenavista II",
    "Buenavista III", "Alingaro", "Biclatan"
  ],

  // Imus, Cavite
  "imus": [
    "Anabu I-A", "Anabu I-B", "Anabu I-C", "Anabu I-D", "Anabu I-E", "Anabu I-F", "Anabu I-G",
    "Anabu II-A", "Anabu II-B", "Anabu II-C", "Anabu II-D", "Anabu II-E", "Anabu II-F",
    "Bucandala I", "Bucandala II", "Bucandala III", "Bucandala IV", "Bucandala V",
    "Malagasang I-A", "Malagasang I-B", "Malagasang I-C", "Malagasang I-D", "Malagasang I-E", "Malagasang I-F", "Malagasang I-G",
    "Malagasang II-A", "Malagasang II-B", "Malagasang II-C", "Malagasang II-D", "Malagasang II-E", "Malagasang II-F", "Malagasang II-G",
    "Palico I", "Palico II", "Palico III", "Palico IV",
    "Poblacion I-A", "Poblacion I-B", "Poblacion I-C", "Poblacion II-A", "Poblacion II-B", "Poblacion III-A", "Poblacion III-B", "Poblacion IV-A", "Poblacion IV-B",
    "Tanzang Luma I", "Tanzang Luma II", "Tanzang Luma III", "Tanzang Luma IV", "Tanzang Luma V", "Tanzang Luma VI",
    "Alapan I-A", "Alapan I-B", "Alapan I-C", "Alapan II-A", "Alapan II-B",
    "Bayan Luma I", "Bayan Luma II", "Bayan Luma III", "Bayan Luma IV", "Bayan Luma V", "Bayan Luma VI", "Bayan Luma VII", "Bayan Luma VIII", "Bayan Luma IX",
    "Carsadang Bago I", "Carsadang Bago II", "Toclong I-A", "Toclong I-B", "Toclong I-C", "Toclong II-A", "Toclong II-B",
    "Pag-Asa I", "Pag-Asa II", "Pag-Asa III", "Medicion I-A", "Medicion I-B", "Medicion II-A", "Medicion II-B"
  ],

  // Bacoor, Cavite
  "bacoor": [
    "Molino I", "Molino II", "Molino III", "Molino IV", "Molino V", "Molino VI", "Molino VII",
    "Queens Row Central", "Queens Row East", "Queens Row West",
    "Habay I", "Habay II", "Niog I", "Niog II", "Niog III",
    "Panapaan I", "Panapaan II", "Panapaan III", "Panapaan IV", "Panapaan V", "Panapaan VI", "Panapaan VII", "Panapaan VIII",
    "Talaba I", "Talaba II", "Talaba III", "Talaba IV", "Talaba V", "Talaba VI", "Talaba VII",
    "Zapote I", "Zapote II", "Zapote III", "Zapote IV", "Zapote V",
    "Salinas I", "Salinas II", "Salinas III", "Salinas IV",
    "Mambog I", "Mambog II", "Mambog III", "Mambog IV", "Mambog V",
    "San Nicolas I", "San Nicolas II", "San Nicolas III",
    "Sineguelasan", "Dulong Bayan", "Kaingin", "Alima", "Digman", "Mabolo I", "Mabolo II", "Mabolo III"
  ],

  // Silang, Cavite
  "silang": [
    "Biga I", "Biga II", "Biluso", "Bulihan", "Carmen", "Hoyo", "Iba",
    "Kaong", "Lalaan I", "Lalaan II", "Litlit", "Lucsuhin", "Malabag",
    "Poblacion I", "Poblacion II", "Poblacion III", "Poblacion IV", "Poblacion V",
    "Pooc I", "Pooc II", "Puting Kahoy", "Sabutan", "San Miguel I", "San Miguel II",
    "San Vicente I", "San Vicente II", "Tartaria", "Tibig", "Tubuan I", "Tubuan II"
  ],

  // Carmona, Cavite
  "carmona": [
    "Cabilang Baybay", "Mabuhay", "Maduya", "Milagrosa", "Poblacion 1",
    "Poblacion 2", "Poblacion 3", "Poblacion 4", "Poblacion 5", "Poblacion 6",
    "Poblacion 7", "Poblacion 8", "Lantic", "Bancal"
  ],

  // Trece Martires, Cavite
  "trece martires": [
    "Aguado", "Cabezas", "Cabuco", "De Ocampo", "Inocencio", "Lallana",
    "Lapidario", "Luciano", "Osorio", "Perez", "San Agustin", "Hugo Perez", "Conchu"
  ],

  // Taguig City
  "taguig": [
    "Fort Bonifacio", "Western Bicutan", "Upper Bicutan", "Central Bicutan",
    "Lower Bicutan", "Bagumbayan", "Ususan", "Tuktukan", "Bambang",
    "Santa Ana", "Hagonoy", "San Miguel", "Ligid-Tipas", "Ibayo-Tipas",
    "Palingon", "Calzada", "Napindan", "Maharlika Village", "South Signal Village",
    "North Signal Village", "Central Signal Village", "Katuparan", "Pinagsama",
    "South Daang Hari", "North Daang Hari", "Pembo", "Comembo", "Rizal",
    "West Rembo", "East Rembo", "Pitogo", "Post Proper Northside", "Post Proper Southside"
  ],

  // Quezon City
  "quezon city": [
    "Batasan Hills", "Commonwealth", "Holy Spirit", "Bagong Silangan",
    "Payatas", "Tandang Sora", "Culiat", "Pasong Tamo", "Fairview",
    "Novaliches Proper", "San Bartolome", "Greater Lagro", "Diliman",
    "Teacher's Village East", "Teacher's Village West", "UP Campus",
    "Project 4", "Project 6", "Project 8", "Socorro (Cubao)", "Kaunlaran",
    "E. Rodriguez", "Loyola Heights", "Matandang Balara", "South Triangle",
    "Kamuning", "Bagong Pag-asa", "Pinyahan", "Santa Monica", "Gulod", "Talipapa"
  ],

  // Makati City
  "makati": [
    "Bel-Air", "Poblacion", "San Lorenzo", "Urdaneta", "Dasmariñas Village",
    "Forbes Park", "Magallanes", "Bangkal", "Palanan", "Pio del Pilar",
    "San Antonio", "San Isidro", "La Paz", "Singkamas", "Carmona",
    "Tejeros", "Kasilawan", "Olympia", "Valenzuela", "Guadalupe Nuevo",
    "Guadalupe Viejo", "Pinagkaisahan", "Santa Cruz"
  ],

  // City of Manila
  "manila": [
    "Binondo", "Ermita", "Malate", "Paco", "Pandacan", "Port Area",
    "Quiapo", "Sampaloc", "San Andres", "San Miguel", "San Nicolas",
    "Santa Ana", "Santa Cruz", "Santa Mesa", "Tondo I", "Tondo II", "Intramuros"
  ],

  // Pasig City
  "pasig": [
    "Bagong Ilog", "Bagong Katipunan", "Bambang", "Buting", "Caniogan",
    "Kapitolyo", "Malinao", "Manggahan", "Maybunga", "Oranbo", "Palatiw",
    "Pinagbuhatan", "Pineda", "Rosario", "Sagad", "San Antonio", "San Joaquin",
    "San Nicolas", "Santa Cruz", "Santa Lucia", "Santa Rosa", "Santo Tomas",
    "Santolan", "Sumilang", "Ugong", "Dela Paz"
  ],

  // Parañaque City
  "paranaque": [
    "Baclaran", "BF Homes", "Don Bosco", "Don Galo", "La Huerta",
    "Marcelo Green", "Merville", "Moonwalk", "San Antonio", "San Dionisio",
    "San Isidro", "San Martin de Porres", "Santo Niño", "Sun Valley", "Tambo", "Vitalez"
  ],

  // Calamba City, Laguna
  "calamba": [
    "Canlubang", "Real", "Bucal", "Pansol", "Halang", "Makiling",
    "Turbina", "Parian", "Mayapa", "Paciano Rizal", "Lecheria", "Lingga",
    "Barandal", "Batino", "Bubuyan", "Kay-Anlog", "La Mesa", "Mapagong",
    "Palo-Alto", "Prinza", "Saimsim", "Sampiruhan", "Sirang Lupa"
  ],

  // Santa Rosa City, Laguna
  "santa rosa": [
    "Balibago", "Dila", "Dita", "Don Jose", "Macabling", "Malitlit",
    "Market Area", "Pooc", "Pulong Santa Cruz", "Sinalhan", "Tagapo",
    "Aplaya", "Caingin", "Ibaba", "Kanluran", "Labas", "Malusak", "Santo Domingo"
  ],

  // Biñan City, Laguna
  "binan": [
    "Canlalay", "Casile", "De La Paz", "Ganado", "Langkiwa", "Loma",
    "Malaban", "Malamig", "Mampalasan", "Platero", "Poblacion", "San Antonio",
    "San Francisco", "San Jose", "San Vicente", "Santo Niño", "Santo Tomas",
    "Soro-Soro", "Timbao", "Tubigan", "Zapote"
  ]
};

// Clean search string helper
export function normalizeText(str) {
  return String(str || "")
    .trim()
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

// Strips "Brgy.", "Brgy", "Barangay", "Bgy." prefix from text so typing "Brgy. Salitran" matches "Salitran"
export function cleanBarangayPrefix(str) {
  return String(str || "")
    .replace(/^(brgy\.?|barangay|bgy\.?)\s+/i, "")
    .trim();
}

/**
 * Searches real Philippine barangays.
 * If city is specified, searches strictly within that city's barangays.
 * If no city is specified, searches across all known barangays and returns { barangay, city, province }.
 */
export function searchBarangays(query, { city, province } = {}, limit = 8) {
  const cleanQ = cleanBarangayPrefix(query);
  const q = normalizeText(cleanQ);
  if (!q) {
    if (city) {
      const cityKey = normalizeText(city);
      const list = PH_BARANGAYS_BY_CITY[cityKey] || [];
      return list.slice(0, limit).map((b) => ({
        barangay: b,
        city: city,
        province: province || findProvinceForCity(city) || "",
      }));
    }
    return [];
  }

  // 1. If city is provided, filter within that city
  if (city) {
    const cityKey = normalizeText(city);
    const list = PH_BARANGAYS_BY_CITY[cityKey] || [];
    const matched = list.filter((b) => {
      const bNorm = normalizeText(cleanBarangayPrefix(b));
      return bNorm.includes(q) || bNorm.replace(/\s+/g, "").includes(q.replace(/\s+/g, ""));
    });

    matched.sort((a, b) => {
      const aNorm = normalizeText(cleanBarangayPrefix(a));
      const bNorm = normalizeText(cleanBarangayPrefix(b));
      const aStarts = aNorm.startsWith(q) ? 0 : 1;
      const bStarts = bNorm.startsWith(q) ? 0 : 1;
      return aStarts - bStarts || a.localeCompare(b);
    });

    return matched.slice(0, limit).map((b) => ({
      barangay: b,
      city: city,
      province: province || findProvinceForCity(city) || "",
    }));
  }

  // 2. If no city provided, search across all cities with city/province tags
  const results = [];
  for (const [cityKey, brgys] of Object.entries(PH_BARANGAYS_BY_CITY)) {
    const cityName = findOfficialCityName(cityKey);
    const provName = findProvinceForCity(cityName) || "";
    if (province && normalizeText(provName) !== normalizeText(province)) continue;

    for (const b of brgys) {
      const bNorm = normalizeText(cleanBarangayPrefix(b));
      if (bNorm.includes(q) || bNorm.replace(/\s+/g, "").includes(q.replace(/\s+/g, ""))) {
        const startsWith = bNorm.startsWith(q);
        results.push({
          barangay: b,
          city: cityName,
          province: provName,
          score: startsWith ? 0 : 1,
        });
      }
    }
  }

  results.sort((a, b) => a.score - b.score || a.barangay.localeCompare(b.barangay));
  return results.slice(0, limit);
}

/**
 * Searches real Philippine cities and municipalities.
 * If province is specified, filters cities in that province.
 */
export function searchCities(query, { province } = {}, limit = 8) {
  const q = normalizeText(query);
  const results = [];

  const provincesToSearch = province
    ? [province]
    : Object.keys(PH_CITIES_BY_PROVINCE);

  for (const prov of provincesToSearch) {
    const cities = PH_CITIES_BY_PROVINCE[prov] || [];
    for (const c of cities) {
      const cNorm = normalizeText(c);
      if (!q || cNorm.includes(q) || cNorm.replace(/\s+/g, "").includes(q.replace(/\s+/g, ""))) {
        const startsWith = cNorm.startsWith(q);
        results.push({
          city: c,
          province: prov,
          score: startsWith ? 0 : 1,
        });
      }
    }
  }

  results.sort((a, b) => a.score - b.score || a.city.localeCompare(b.city));
  return results.slice(0, limit);
}

/**
 * Searches Philippine provinces.
 */
export function searchProvinces(query, limit = 8) {
  const q = normalizeText(query);
  if (!q) return PH_PROVINCES.slice(0, limit);
  return PH_PROVINCES
    .filter((p) => normalizeText(p).includes(q))
    .sort((a, b) => {
      const aStarts = normalizeText(a).startsWith(q) ? 0 : 1;
      const bStarts = normalizeText(b).startsWith(q) ? 0 : 1;
      return aStarts - bStarts || a.localeCompare(b);
    })
    .slice(0, limit);
}

export function getCitiesForProvince(provinceName) {
  return PH_CITIES_BY_PROVINCE[provinceName] || [];
}

export function getBarangaysForCity(cityName) {
  if (!cityName) return [];
  const cityKey = normalizeText(cityName);
  return PH_BARANGAYS_BY_CITY[cityKey] || [];
}

export function findProvinceForCity(cityName) {
  if (!cityName) return null;
  const q = normalizeText(cityName);
  for (const [prov, cities] of Object.entries(PH_CITIES_BY_PROVINCE)) {
    if (cities.some((c) => normalizeText(c) === q)) {
      return prov;
    }
  }
  return null;
}

export function findCityForBarangay(barangayName) {
  if (!barangayName) return null;
  const q = normalizeText(cleanBarangayPrefix(barangayName));
  for (const [cityKey, brgys] of Object.entries(PH_BARANGAYS_BY_CITY)) {
    const found = brgys.find((b) => normalizeText(cleanBarangayPrefix(b)) === q);
    if (found) {
      const cityName = findOfficialCityName(cityKey);
      return {
        barangay: found,
        city: cityName,
        province: findProvinceForCity(cityName) || "",
      };
    }
  }
  return null;
}

function findOfficialCityName(cityKey) {
  for (const cities of Object.values(PH_CITIES_BY_PROVINCE)) {
    const match = cities.find((c) => normalizeText(c) === cityKey);
    if (match) return match;
  }
  return cityKey.charAt(0).toUpperCase() + cityKey.slice(1);
}

/**
 * Parses a raw or legacy combined address string into structured parts:
 * { house_number, street, barangay, city, province }
 */
export function parseAddressString(rawAddress) {
  const empty = { house_number: "", street: "", barangay: "", city: "", province: "" };
  if (!rawAddress || typeof rawAddress !== "string") return empty;

  const text = rawAddress.trim();
  if (!text) return empty;

  const parts = text.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length === 1) {
    return { ...empty, street: parts[0] };
  }

  let province = "";
  let city = "";
  let barangay = "";
  let street = "";
  let house_number = "";

  // Check last segment for province
  const lastSegment = parts[parts.length - 1];
  const matchedProv = PH_PROVINCES.find((p) => normalizeText(p) === normalizeText(lastSegment));
  if (matchedProv) {
    province = matchedProv;
    parts.pop();
  }

  // Check next segment for city
  if (parts.length > 0) {
    const citySegment = parts[parts.length - 1];
    let matchedCity = null;
    for (const [prov, cities] of Object.entries(PH_CITIES_BY_PROVINCE)) {
      const c = cities.find((name) => normalizeText(name) === normalizeText(citySegment));
      if (c) {
        matchedCity = c;
        if (!province) province = prov;
        break;
      }
    }
    if (matchedCity) {
      city = matchedCity;
      parts.pop();
    }
  }

  // Check next segment for barangay
  if (parts.length > 0) {
    const brgySegment = parts[parts.length - 1];
    if (/^(brgy|barangay|bgy)/i.test(brgySegment)) {
      barangay = brgySegment;
      parts.pop();
    } else if (city) {
      const brgys = getBarangaysForCity(city);
      const matchedB = brgys.find(
        (b) => normalizeText(cleanBarangayPrefix(b)) === normalizeText(cleanBarangayPrefix(brgySegment))
      );
      if (matchedB) {
        barangay = matchedB;
        parts.pop();
      }
    }
  }

  // Remaining front parts are street and house number
  if (parts.length > 0) {
    const first = parts[0];
    if (/^(unit|blk|block|lot|flr|floor|#|\d+)/i.test(first) && parts.length > 1) {
      house_number = first;
      street = parts.slice(1).join(", ");
    } else {
      street = parts.join(", ");
    }
  }

  return { house_number, street, barangay, city, province };
}

