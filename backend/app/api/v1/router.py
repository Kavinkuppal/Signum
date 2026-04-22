from fastapi import APIRouter
from app.api.v1 import products, suppliers, auth, seed, scrape, projects, local_suppliers

router = APIRouter()
router.include_router(products.router, prefix="/products", tags=["products"])
router.include_router(suppliers.router, prefix="/suppliers", tags=["suppliers"])
router.include_router(auth.router, prefix="/auth", tags=["auth"])
router.include_router(seed.router, prefix="/demo", tags=["demo"])
router.include_router(scrape.router, prefix="/scrape", tags=["scrape"])
router.include_router(projects.router, prefix="/projects", tags=["projects"])
router.include_router(local_suppliers.router, prefix="/local-suppliers", tags=["local-suppliers"])
