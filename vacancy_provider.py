import sqlite3
import os
from dataclasses import dataclass
from typing import Optional

@dataclass
class Vacancy:
    short_id: str
    title: str
    company: str
    stack: str
    requirements: str
    vibes: str

class VacancyProvider:
    def __init__(self, db_path: str = "openclaw/workspace/jobs_warehouse.sqlite"):
        self.db_path = db_path

    def get_vacancy(self, short_id: str) -> Optional[Vacancy]:
        """Fetch vacancy details by short_id from the jobs warehouse."""
        try:
            # Use absolute path if relative doesn't work, but given the structure:
            # If app.py is in openclaw/mlops_tutor, then ../workspace/jobs_warehouse.sqlite
            # Let's try to handle both.
            actual_path = self.db_path
            if not os.path.exists(actual_path):
                # Try to resolve relative to the project root
                # This is a bit hacky, but we'll try to find it
                actual_path = os.path.expanduser("~/openclaw/workspace/jobs_warehouse.sqlite")
                if not os.path.exists(actual_path):
                    return None

            conn = sqlite3.connect(actual_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            cursor.execute(
                "SELECT short_id, title, company, stack, requirements, vibes FROM vacancies WHERE short_id = ?", 
                (short_id,)
            )
            row = cursor.fetchone()
            conn.close()

            if row:
                return Vacancy(
                    short_id=row['short_id'],
                    title=row['title'] or "N/A",
                    company=row['company'] or "N/A",
                    stack=row['stack'] or "N/A",
                    requirements=row['requirements'] or "N/A",
                    vibes=row['vibes'] or "N/A"
                )
        except Exception as e:
            print(f"Error fetching vacancy {short_id}: {e}")
        return None

# Singleton instance
provider = VacancyProvider()
