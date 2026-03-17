from app.scrapers.shopify_base import ShopifyScraper


class McLoganScraper(ShopifyScraper):
    supplier_name = "mclogan"
    base_url = "https://www.mclogan.com"
    collection = "all"

    CATEGORY_MAP = {
        "Vinyl": "Vinyl",
        "Heat Transfer Vinyl": "Vinyl",
        "Substrates": "Substrate",
        "Aluminum": "Aluminum",
        "Banner": "Banner",
        "Laminate": "Laminate",
        "Inks": "Ink",
        "Hardware": "Hardware",
    }
