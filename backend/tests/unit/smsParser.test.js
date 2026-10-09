const { parseSmsReport, REPORT_TYPE_MAP } = require("../../src/services/sms/smsParser");

describe("SMS Community Report Parser (smsParser)", () => {
  describe("Valid Message Parsing", () => {
    test("parses standard hash-delimited format (REPORT <TYPE> # <LOCATION> # <DESCRIPTION>)", () => {
      const sms = "REPORT SIGHTING # Yala Block 1 near tank # 3 wild elephants approaching paddy boundary";
      const result = parseSmsReport(sms);

      expect(result.reportType).toBe("WILDLIFE_SIGHTING");
      expect(result.manualLocation).toBe("Yala Block 1 near tank");
      expect(result.description).toBe("3 wild elephants approaching paddy boundary");
      expect(result.species).toBe("Elephant");
      expect(result.isAnonymous).toBe(false);
    });

    test("parses dash-delimited format (REPORT <TYPE> - <LOCATION> - <DESCRIPTION>)", () => {
      const sms = "REPORT CONFLICT - Wilpattu boundary village - Wild elephant damaged crop storehouse";
      const result = parseSmsReport(sms);

      expect(result.reportType).toBe("HUMAN_WILDLIFE_CONFLICT");
      expect(result.manualLocation).toBe("Wilpattu boundary village");
      expect(result.description).toBe("Wild elephant damaged crop storehouse");
      expect(result.species).toBe("Elephant");
      expect(result.isAnonymous).toBe(false);
    });

    test("parses semicolon-delimited format", () => {
      const sms = "REPORT SUSPICIOUS ; Sector 4 canal track ; Wire snares set along forest path";
      const result = parseSmsReport(sms);

      expect(result.reportType).toBe("SUSPICIOUS_ACTIVITY");
      expect(result.manualLocation).toBe("Sector 4 canal track");
      expect(result.description).toBe("Wire snares set along forest path");
      expect(result.isAnonymous).toBe(false);
    });

    test("parses pipe-delimited format", () => {
      const sms = "REPORT SIGHTING | Kataragama Road | Leopard spotted crossing near culvert";
      const result = parseSmsReport(sms);

      expect(result.reportType).toBe("WILDLIFE_SIGHTING");
      expect(result.manualLocation).toBe("Kataragama Road");
      expect(result.description).toBe("Leopard spotted crossing near culvert");
      expect(result.species).toBe("Leopard");
    });

    test("parses labeled LOC: and DESC: format", () => {
      const sms = `REPORT SIGHTING
LOC: Bundala Lagoon perimeter
DESC: Large crocodile observed on riverbank near bridge`;
      const result = parseSmsReport(sms);

      expect(result.reportType).toBe("WILDLIFE_SIGHTING");
      expect(result.manualLocation).toBe("Bundala Lagoon perimeter");
      expect(result.description).toBe("Large crocodile observed on riverbank near bridge");
      expect(result.species).toBe("Crocodile");
    });

    test("parses messages without REPORT prefix", () => {
      const sms = "SIGHTING # Sigiriya sanctuary buffer # Wild boar group entering home garden";
      const result = parseSmsReport(sms);

      expect(result.reportType).toBe("WILDLIFE_SIGHTING");
      expect(result.manualLocation).toBe("Sigiriya sanctuary buffer");
      expect(result.description).toBe("Wild boar group entering home garden");
      expect(result.species).toBe("Wild boar");
    });

    test("handles REPORT ANON prefix and sets isAnonymous: true", () => {
      const sms = "REPORT ANON SUSPICIOUS # Northern canal gate # Two men carrying illegal timber";
      const result = parseSmsReport(sms);

      expect(result.reportType).toBe("SUSPICIOUS_ACTIVITY");
      expect(result.manualLocation).toBe("Northern canal gate");
      expect(result.description).toBe("Two men carrying illegal timber");
      expect(result.isAnonymous).toBe(true);
    });

    test("handles species in type keyword (e.g. SIGHTING ELEPHANT)", () => {
      const sms = "REPORT SIGHTING ELEPHANT # Udawalawe border # Solitary bull elephant near water channel";
      const result = parseSmsReport(sms);

      expect(result.reportType).toBe("WILDLIFE_SIGHTING");
      expect(result.species).toBe("Elephant");
      expect(result.manualLocation).toBe("Udawalawe border");
      expect(result.description).toBe("Solitary bull elephant near water channel");
    });
  });

  describe("Keyword and Category Mapping", () => {
    test("maps various conflict synonyms to HUMAN_WILDLIFE_CONFLICT", () => {
      const synonyms = ["CONFLICT", "ATTACK", "DAMAGE", "CROP", "HWC", "RAID"];
      for (const syn of synonyms) {
        const sms = `REPORT ${syn} # Village boundary # Animals damaging banana plantation`;
        const result = parseSmsReport(sms);
        expect(result.reportType).toBe("HUMAN_WILDLIFE_CONFLICT");
      }
    });

    test("maps suspicious synonyms to SUSPICIOUS_ACTIVITY", () => {
      const synonyms = ["SUSPICIOUS", "POACHING", "TRAP", "SNARE", "ILLEGAL", "LOGGING"];
      for (const syn of synonyms) {
        const sms = `REPORT ${syn} # Ridge pathway # Suspicious equipment observed`;
        const result = parseSmsReport(sms);
        expect(result.reportType).toBe("SUSPICIOUS_ACTIVITY");
      }
    });

    test("maps sighting synonyms to WILDLIFE_SIGHTING", () => {
      const synonyms = ["SIGHTING", "SIGHT", "WILDLIFE", "ANIMAL"];
      for (const syn of synonyms) {
        const sms = `REPORT ${syn} # Ridge pathway # Spotted deer grazing`;
        const result = parseSmsReport(sms);
        expect(result.reportType).toBe("WILDLIFE_SIGHTING");
      }
    });
  });

  describe("Validation & Malformed Message Handling", () => {
    test("rejects empty or whitespace-only SMS message", () => {
      expect(() => parseSmsReport("")).toThrow("SMS message body is empty");
      expect(() => parseSmsReport("   ")).toThrow("SMS message body is empty");
      expect(() => parseSmsReport(null)).toThrow("SMS message body is empty");
    });

    test("rejects unsupported report types with helpful error", () => {
      const sms = "REPORT WEATHER # Colombo # Raining heavily";
      expect(() => parseSmsReport(sms)).toThrow("Unsupported report type: 'WEATHER'");
    });

    test("rejects messages with missing location", () => {
      const sms = "REPORT SIGHTING # # Elephant spotted";
      expect(() => parseSmsReport(sms)).toThrow("Location is missing");
    });

    test("rejects messages with description shorter than 5 characters", () => {
      const sms = "REPORT SIGHTING # Yala Sector 2 # bad";
      expect(() => parseSmsReport(sms)).toThrow("Description must be at least 5 characters");
    });
  });
});
