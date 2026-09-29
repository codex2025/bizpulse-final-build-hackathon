from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", protected_namespaces=())

    openai_api_key: str = ""
    decision_planner_model: str = "gpt-4o-mini"
    model_name: str = "gpt-4o"
    max_tokens: int = 2000
    database_url: str = ""
    chroma_persist_dir: str = "./chroma_data"
    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"

settings = Settings()


