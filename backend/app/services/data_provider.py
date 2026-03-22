from abc import ABC, abstractmethod
from typing import Optional


class DataProvider(ABC):
    @abstractmethod
    async def get_live_score(self, match_id: int) -> Optional[dict]:
        ...

    @abstractmethod
    async def get_player_performance(self, match_id: int) -> list[dict]:
        ...

    @abstractmethod
    async def get_upcoming_matches(self) -> list[dict]:
        ...


class MockDataProvider(DataProvider):
    """Uses seeded database data. No external calls."""

    async def get_live_score(self, match_id: int) -> Optional[dict]:
        return None

    async def get_player_performance(self, match_id: int) -> list[dict]:
        return []

    async def get_upcoming_matches(self) -> list[dict]:
        return []
