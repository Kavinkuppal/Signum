from app.scrapers.shopify_base import ShopifyScraper


class BlueRidgeScraper(ShopifyScraper):
    supplier_name = "blue_ridge"
    base_url = "https://blueridgesignsupply.com"
    collection = "all"

    CATEGORY_MAP = {
        "Aluminum": "Aluminum",
        "Sign Blanks": "Aluminum",
        "Vinyl": "Vinyl",
        "Banner Material": "Banner",
        "Substrates": "Substrate",
        "Coroplast": "Coroplast",
        "Laminate": "Laminate",
        "Hardware": "Hardware",
        "LED": "LED",
        "Acrylic": "Acrylic",
        "Ink": "Ink",
    }
