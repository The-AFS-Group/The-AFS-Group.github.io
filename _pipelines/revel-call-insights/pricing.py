"""Who raised price first on a call: the sales rep (an unprompted offer) or the customer.

Works on the Aircall transcript, where every line starts with "internal:" (Revel
staff) or "external:" (the customer). It finds the first customer line that
pushes on price and the first rep line that offers something on price, then
compares their order:

  U   rep offered before the customer pushed (or the customer never pushed)
  PO  customer pushed first, rep then made an offer
  PH  customer pushed, rep made no offer afterwards (price held)
  N   no discount or price-pressure talk either way

Offer types: D a discount or deal the rep put on the table, P an existing sale
or promotion the rep pointed to, F free delivery or a free add-on.
"""
import re


def _rx(*patterns):
    return re.compile("|".join(patterns), re.I)


PRESSURE = _rx(
    r"\bdiscount", r"\bbest (?:price|deal|you can do|you could do)", r"\bbetter (?:price|deal)",
    r"\b(?:any|got|have|running|there) (?:any )?(?:deals?|specials?|promos?|promotions?|sales?|discounts?)\b",
    r"\bon (?:sale|special)\b", r"\b(?:next|upcoming|another) sale\b", r"\bblack friday\b", r"\bboxing day\b",
    r"\bcyber monday\b", r"\beofy\b", r"\bend of (?:the )?(?:financial )?year sale",
    r"\btoo (?:expensive|pricey|dear)\b", r"\b(?:bit|quite|very|so|pretty|really|little) (?:expensive|pricey|steep|dear)\b",
    r"\b(?:out of|over|above|outside|beyond|exceeds?) (?:my|our|the) budget\b",
    r"\bcheaper (?:elsewhere|somewhere|online|price|at|from|on)\b", r"\bfound (?:it|one|them)\b.{0,40}\bcheaper\b",
    r"\bprice ?match", r"\bmatch (?:the|that|their|it|his|her) price", r"\bprice beat",
    r"\bknock (?:off|some|anything|a bit|it down|that down)", r"\bcome down (?:on|in|a bit|a little|any)",
    r"\bbring (?:it|the price|that) down", r"\b(?:drop|lower|reduce) (?:the|your|that) price", r"\bwiggle room",
    r"\bnegotiat", r"\bflexib\w* (?:on|with) (?:the )?price", r"\bhaggl",
    r"\bthrow (?:in|it in|that in|them in)\b", r"\b(?:discount|promo|promotional|coupon|voucher) code", r"\bcoupon",
    r"\bvoucher", r"\b(?:do|give) (?:me|us) a (?:deal|discount|better price)", r"\bany (?:room|movement) on (?:the )?price",
)

_DISCOUNT_WORDS = _rx(
    r"\bdiscount", r"\b\d+ ?(?:%|percent) (?:off|discount)", r"\b\d[\d,]* (?:dollars )?off\b", r"\bdollars off\b",
    r"\bspecial (?:price|pricing|deal|offer|rate)", r"\bbest price\b", r"\bbetter price\b", r"\bprice ?match",
    r"\bmatch (?:the|that|their|his|her) price", r"\bknock (?:off|it|some|that|a)", r"\btake (?:off|\$?\d[\d,]* off)",
    r"\bbring (?:it|that|the price) down to\b", r"\bcome down to \$?\d", r"\bdo (?:it|that|this) for (?:\$|you at )?\d", r"\bwiggle room", r"\bsharpen",
    r"\bnegotiat", r"\bdeal for you\b", r"\bcustom (?:discount|deal|price)",
)
# The rep putting something on the table, as opposed to describing a public sale price.
_AGENCY = _rx(
    r"\b(?:i|we)(?:'ll|'d| will| can| could| would| might| may| should)?(?: be able to)?(?: probably| possibly| definitely| happily| certainly| try and| try to)? "
    r"(?:do|offer|give|apply|throw|knock|take|sharpen|match|get you|look into|see if|organi[sz]e|put|honou?r|extend)\b",
    r"\bfor you\b", r"\bcustom (?:discount|deal|price)", r"\bspecial (?:price|deal|offer) for\b",
)
_PROMO_WORDS = _rx(
    r"\bdiscount", r"\b\d+ ?(?:%|percent) off", r"\bon sale\b", r"\bsale price", r"\b(?:the|our|current|this) sale\b",
    r"\bblack friday", r"\bpromo(?:tion)?s?\b", r"\bpromotional", r"\b(?:discount|promo|coupon|voucher) code",
    r"\bvoucher", r"\bcoupon", r"\bon special\b", r"\bspecials\b", r"\bend of (?:the )?(?:financial )?year", r"\beofy\b",
    r"\bboxing day", r"\bcyber monday", r"\bpre-?order (?:price|pricing|discount|special|offer)", r"\bearly bird",
    r"\bmother'?s day (?:sale|special|price)", r"\bfather'?s day (?:sale|special|price)",
)
_FREEBIE_WORDS = _rx(
    r"\bfree (?:delivery|shipping|installation|install|freight|bucket|accessor\w*|ladle|stones|rocks|cover|hat|upgrade|gift)",
    r"\bwaiv\w*", r"\bthrow (?:in|it in|that in|them in)\b", r"\bcomplimentary", r"\bon the house", r"\bbundle",
)

# Any offer phrase, for pulling a short quote out of a long transcript line.
OFFER_ANY = re.compile("|".join(r.pattern for r in (_DISCOUNT_WORDS, _PROMO_WORDS, _FREEBIE_WORDS)), re.I)

CLASS_LABELS = {
    "U": "Rep offered unprompted",
    "PO": "Customer pushed, rep offered",
    "PH": "Customer pushed, price held",
    "N": "No discount talk",
}
OFFER_LABELS = {"D": "Discount or deal", "P": "Sale or promo", "F": "Free delivery or add-on"}


def _offer_type(text):
    if _DISCOUNT_WORDS.search(text) and _AGENCY.search(text):
        return "D"
    if _FREEBIE_WORDS.search(text):
        return "F"
    if _DISCOUNT_WORDS.search(text) or _PROMO_WORDS.search(text):
        return "P"
    return None


def turns(transcript):
    out = []
    for line in (transcript or "").split("\n"):
        speaker, sep, text = line.partition(":")
        speaker = speaker.strip().lower()
        if sep and speaker in ("internal", "external"):
            out.append((speaker, text.strip()))
    return out


def analyse(call_turns):
    """Return (class, offer_type, pressure_line, offer_line)."""
    pressure_at, pressure_line = None, ""
    first_offer = None      # (index, type, line)
    offer_after = None      # first offer after the customer pushed
    for i, (speaker, text) in enumerate(call_turns):
        if speaker == "external":
            if pressure_at is None and PRESSURE.search(text):
                pressure_at, pressure_line = i, text
            continue
        kind = _offer_type(text)
        if not kind:
            continue
        if first_offer is None:
            first_offer = (i, kind, text)
        if pressure_at is not None and offer_after is None and i > pressure_at:
            offer_after = (i, kind, text)
    if first_offer and (pressure_at is None or first_offer[0] < pressure_at):
        return "U", first_offer[1], pressure_line, first_offer[2]
    if pressure_at is not None and offer_after:
        return "PO", offer_after[1], pressure_line, offer_after[2]
    if pressure_at is not None:
        return "PH", "", pressure_line, ""
    return "N", "", "", ""
