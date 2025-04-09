// scoring.js
// Turkish license plate scoring system with automatic plate type detection

// Province rarity tiers based on population size and vehicle registrations
const provinceTiers = {
  // Tier 1 (Major Cities, High Registration): 0 points
  "01": 1.5, // Adana
  "06": 1.5, // Ankara (capital)
  "07": 1.5, // Antalya
  "16": 1.5, // Bursa
  "34": 1.5, // Istanbul (largest city)
  "35": 1.5, // Izmir

  // Tier 2 (Mid-sized Provinces): 10 points
  "02": 2.5, // Adıyaman
  "04": 2.5, // Ağrı
  "09": 2.5, // Aydın
  "10": 2.5, // Balıkesir
  "11": 2.5, // Bilecik
  "20": 2.5, // Denizli
  "21": 2.5, // Diyarbakır
  "25": 2.5, // Erzurum
  "26": 2.5, // Eskişehir
  "27": 2.5, // Gaziantep
  "31": 2.5, // Hatay
  "38": 2.5, // Kayseri
  "41": 2.5, // Kocaeli
  "42": 2.5, // Konya
  "43": 2.5, // Kütahya
  "44": 2.5, // Malatya
  "45": 2.5, // Manisa
  "46": 2.5, // Kahramanmaraş
  "47": 2.5, // Mardin
  "48": 2.5, // Muğla
  "54": 2.5, // Sakarya
  "55": 2.5, // Samsun
  "59": 2.5, // Tekirdağ
  "61": 2.5, // Trabzon

  // Tier 3 (Smaller Provinces): 25 points
  "03": 5, // Afyonkarahisar
  "05": 5, // Amasya
  "08": 5, // Artvin
  "12": 5, // Bingöl
  "13": 5, // Bitlis
  "14": 5, // Bolu
  "15": 5, // Burdur
  "17": 5, // Çanakkale
  "18": 5, // Çankırı
  "19": 5, // Çorum
  "22": 5, // Edirne
  "23": 5, // Elazığ
  "24": 5, // Erzincan
  "28": 5, // Giresun
  "29": 5, // Gümüşhane
  "30": 5, // Hakkari
  "32": 5, // Isparta
  "36": 5, // Kars
  "37": 5, // Kastamonu
  "39": 5, // Kırklareli
  "40": 5, // Kırşehir
  "49": 5, // Muş
  "50": 5, // Nevşehir
  "51": 5, // Niğde
  "52": 5, // Ordu
  "53": 5, // Rize
  "56": 5, // Siirt
  "57": 5, // Sinop
  "58": 5, // Sivas
  "60": 5, // Tokat
  "62": 5, // Tunceli
  "63": 5, // Şanlıurfa
  "64": 5, // Uşak
  "65": 5, // Van
  "66": 5, // Yozgat
  "67": 5, // Zonguldak
  "68": 5, // Aksaray
  "69": 5, // Bayburt
  "70": 5, // Karaman
  "71": 5, // Kırıkkale
  "72": 5, // Batman
  "73": 5, // Şırnak
  "74": 5, // Bartın
  "77": 5, // Yalova
  "78": 5, // Karabük
  "79": 5, // Kilis
  "80": 5, // Osmaniye

  // Tier 4 (Least Populated/Rural): 50 points
  "33": 10, // Mersin
  "75": 10, // Ardahan
  "76": 10, // Iğdır
  "81": 10, // Düzce

  // Default value if province not found
  default: 1,
};

// Special plate types with their scores
const specialPlateTypes = {
  STANDARD: 1, // Regular civilian plates
  UNIVERSITY: 15, // University/Rectorate plates (AA)
  POLICE: 20, // Police plates (A or AAA)
  GENDARMERIE: 25, // Gendarmerie plates (JAA)
  COAST_GUARD: 25, // Coast Guard plates (SGH)
  DIPLOMATIC: 30, // Diplomatic plates (CD)
  CONSULATE: 25, // Consulate plates (CC)
  FOREIGN: 20, // Foreign resident plates (MA-MZ)
  TAXI: 15, // Taxi plates (TAA-TKZ)
};

/**
 * Parse a Turkish license plate into its components
 * @param {string} plateText - Full plate text (e.g., "34AB123", "06ABC01")
 * @returns {Object} Parsed components { provinceCode, letters, digits }
 */
function parseTurkishPlate(plateText) {
  // Remove spaces, hyphens or other separators
  plateText = plateText.replace(/[\s-]/g, "").toUpperCase();

  // Extract province code (first 1-2 digits)
  const provinceMatch = plateText.match(/^(\d{1,2})/);
  const provinceCode = provinceMatch ? provinceMatch[1].padStart(2, "0") : "";

  // After province, extract letters (typically 1-3 letters)
  let remainingText = plateText.substring(provinceCode.length);
  const lettersMatch = remainingText.match(/^([A-Z]+)/);
  const letters = lettersMatch ? lettersMatch[1] : "";

  // After letters, extract digits
  remainingText = remainingText.substring(letters.length);
  const digitsMatch = remainingText.match(/^(\d+)/);
  const digits = digitsMatch ? digitsMatch[1] : "";

  return { provinceCode, letters, digits };
}

/**
 * Detect the plate type based on letter patterns
 * @param {string} letters - The letter portion of the plate
 * @returns {string} The detected plate type
 */
function detectPlateType(letters) {
  // Check for special types
  if (letters === "AA") {
    return "UNIVERSITY"; // Universities/Rectorates
  } else if (letters === "A" || letters === "AAA") {
    return "POLICE"; // Police
  } else if (letters === "JAA") {
    return "GENDARMERIE"; // Gendarmerie
  } else if (letters === "SGH") {
    return "COAST_GUARD"; // Coast Guard
  } else if (letters === "CD") {
    return "DIPLOMATIC"; // Diplomatic Corps
  } else if (letters === "CC") {
    return "CONSULATE"; // Consulates
  } else if (letters.length === 2 && letters >= "MA" && letters <= "MZ") {
    return "FOREIGN"; // Foreign residents
  } else if (letters.length === 3 && letters >= "TAA" && letters <= "TKZ") {
    return "TAXI"; // Taxis
  }

  return "STANDARD"; // Regular civilian plate
}

/**
 * Calculate the score for a Turkish license plate
 * @param {string} plateText - The full plate text (e.g., "34AB123")
 * @returns {Object} The calculated score and breakdown
 */
function calculatePlateScore(plateText) {
  // Initialize score components
  let provinceScore = 0;
  let letterScore = 1;
  let digitScore = 0;
  let specialScore = 0;

  // Parse the plate
  const { provinceCode, letters, digits } = parseTurkishPlate(plateText);

  // Detect plate type based on letter pattern
  const plateType = detectPlateType(letters);

  // 1. Calculate province rarity score
  provinceScore = provinceTiers[provinceCode] || provinceTiers.default;

  // 2. Calculate letter pattern score (only for standard plates)
  if (plateType === "STANDARD" && letters) {
    // Check for repeating letters
    if (letters.length >= 2) {
      // All same letter (e.g., BB)
      if (new Set(letters.split("")).size === 1) {
        letterScore = letters.length >= 3 ? 20 : 10; // Triple or double letters
      }

      // Sequential letters (e.g., ABC, XYZ)
      else if (isSequential(letters)) {
        letterScore = 5;
      }

      // Special case: All letters in plate are the same (e.g., AAA)
      if (letters.length >= 3 && new Set(letters.split("")).size === 1) {
        letterScore = 7.5; // Boost for all same letter across plate
      }
    }
  }

  // 2. Calculate letter pattern score (original logic would be here)
  // Then add this new letter sum calculation:
  let letterSum = 1;
  for (let i = 0; i < letters.length; i++) {
    // Calculate position in alphabet (A=1, B=2, ..., Z=26)
    const letterPosition = letters.charCodeAt(i) - 64; // 'A' is ASCII 65, so subtract 64 to get 1

    // Only add if it's a valid letter (A-Z)
    if (letterPosition >= 1 && letterPosition <= 26) {
      letterSum *= letterPosition;
    }
  }

  // Add letter sum to the existing letter score
  letterScore += letterSum;

  // 3. Calculate digit pattern score
  const numDigits = parseInt(digits) || 1;

  let digitSum = 0;
  const digitString = digits.toString();
  for (let i = 0; i < digitString.length; i++) {
    digitSum += parseInt(digitString[i]) || 1;
  }

  if (numDigits <= 9) {
    digitScore = 10; // 001-009
  } else if (numDigits <= 99) {
    digitScore = 5; // 010-099
  } else if (numDigits <= 999) {
    digitScore = 2.5; // 100-999
  } else {
    digitScore = 1; // 1000+
  }

  // 4. Calculate special plate type score
  specialScore = specialPlateTypes[plateType] || 1;

  // Total score calculation
  const totalScore =
    (letterScore + digitSum) * digitScore * provinceScore * specialScore;

  return {
    totalScore,
    plateType,
    breakdown: {
      province: provinceScore,
      letters: letterScore,
      digits: digitScore,
      digitsum: digitSum,
      special: specialScore,
    },
    parsed: { provinceCode, letters, digits },
  };
}

/**
 * Helper function to check if letters are sequential
 * @param {string} letters - Letter sequence to check
 * @returns {boolean} True if letters are sequential
 */
function isSequential(letters) {
  // Special sequences to check
  const sequentialPatterns = [
    "ABC",
    "BCD",
    "CDE",
    "DEF",
    "EFG",
    "FGH",
    "GHI",
    "HIJ",
    "IJK",
    "JKL",
    "KLM",
    "LMN",
    "MNO",
    "NOP",
    "OPR",
    "PRS",
    "RST",
    "STU",
    "TUV",
    "UVY",
    "VYZ",
  ];

  return sequentialPatterns.some((pattern) => letters.includes(pattern));
}

/**
 * Get a human-readable name for plate type
 * @param {string} plateType - The plate type code
 * @returns {string} Human-readable plate type
 */
function getPlateTypeDisplay(plateType) {
  const displayNames = {
    STANDARD: "Standard Civilian",
    UNIVERSITY: "University/Rectorate",
    POLICE: "Police",
    GENDARMERIE: "Gendarmerie",
    COAST_GUARD: "Coast Guard",
    DIPLOMATIC: "Diplomatic Corps",
    CONSULATE: "Consulate",
    FOREIGN: "Foreign Resident",
    TAXI: "Taxi",
  };

  return displayNames[plateType] || plateType;
}

module.exports = {
  calculatePlateScore,
  parseTurkishPlate,
  detectPlateType,
  getPlateTypeDisplay,
  provinceTiers,
  specialPlateTypes,
};
