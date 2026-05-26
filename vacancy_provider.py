from dataclasses import dataclass


@dataclass
class Vacancy:
    company: str
    title: str
    stack: str
    requirements: str
    vibes: str = ""
