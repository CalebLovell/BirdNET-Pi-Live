import json
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))

from species import format_species_json


class SpeciesJsonTests(unittest.TestCase):
    def test_formats_range_results_as_machine_readable_json(self):
        payload = json.loads(
            format_species_json(
                "BirdNET_GLOBAL_6K_V2.4_Model_FP16",
                31,
                0.03,
                [
                    (0.91, "Canis latrans_Coyote"),
                    (0.42, "Sciurus carolinensis_Eastern Gray Squirrel"),
                ],
            )
        )
        self.assertEqual(payload["model"], "BirdNET_GLOBAL_6K_V2.4_Model_FP16")
        self.assertEqual(payload["week"], 31)
        self.assertEqual(payload["threshold"], 0.03)
        self.assertEqual(
            payload["species"],
            [
                {"sciName": "Canis latrans", "comName": "Coyote", "probability": 0.91},
                {
                    "sciName": "Sciurus carolinensis",
                    "comName": "Eastern Gray Squirrel",
                    "probability": 0.42,
                },
            ],
        )


if __name__ == "__main__":
    unittest.main()
