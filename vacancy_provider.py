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

def _find_db() -> str:
    candidates = [
        os.path.join(os.path.dirname(__file__), "data", "jobs_warehouse.sqlite"),
        os.path.expanduser("~/openclaw/workspace/jobs_warehouse.sqlite"),
        "/Users/eddubnitsky/openclaw/workspace/jobs_warehouse.sqlite",
    ]
    for path in candidates:
        if os.path.exists(path):
            return path
    return candidates[0]


class VacancyProvider:
    def get_vacancy(self, short_id: str) -> Optional[Vacancy]:
        db_path = _find_db()
        try:
            if not os.path.exists(db_path):
                return None

            conn = sqlite3.connect(db_path)
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

    @property
    def db_path(self) -> str:
        return _find_db()


provider = VacancyProvider()
