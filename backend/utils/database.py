from motor.motor_asyncio import AsyncIOMotorClient
import os

mongo_url = os.environ.get('MONGO_URL')
db_name = os.environ.get('DB_NAME', 'easybill')

client = AsyncIOMotorClient(mongo_url)
db = client[db_name]
