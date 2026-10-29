"""Keyword rules that sort each analysed Aircall call into dashboard categories.

The upstream sheet already holds one AI analysis per call, but most of its
fields are free text (2,000+ distinct trigger and outcome phrasings). These
rules fold that text into a short, stable list of buckets so the dashboard can
count and filter them. Rules are checked in order; the first match wins unless
a function says it returns several labels.
"""
import re


def _rx(*patterns):
    return re.compile("|".join(patterns), re.I)


# --- Product category ---------------------------------------------------------

TRADITIONAL, INFRARED, COLD = "Traditional sauna", "Infrared sauna", "Ice bath & chiller"
PRODUCT_CATEGORIES = [TRADITIONAL, INFRARED, COLD]

# Revel model names, mapped from how the sheet's own category field labels them.
_MODEL_CATEGORY = {
    "nova": INFRARED, "aura": INFRARED, "eclipse": INFRARED, "luna": INFRARED, "lunar": INFRARED,
    "cora": INFRARED, "kora": INFRARED,
    "solaris": TRADITIONAL, "eden": TRADITIONAL, "edenview": TRADITIONAL, "aden": TRADITIONAL,
    "loom": TRADITIONAL, "aurora": TRADITIONAL, "verda": TRADITIONAL, "verta": TRADITIONAL,
    "virta": TRADITIONAL, "tampere": TRADITIONAL, "tampier": TRADITIONAL, "tempe": TRADITIONAL,
    "kusi": TRADITIONAL, "xenio": TRADITIONAL, "cylindro": TRADITIONAL, "harvia": TRADITIONAL,
    "huum": TRADITIONAL,
    "glacier": COLD, "freeze": COLD, "arctic": COLD,
}
_TRAD_WORDS = _rx(r"\btraditional", r"\bbarrel", r"\bheater", r"\bwood[- ]?fired", r"\bsteam", r"\bsauna (?:stones|rocks)",
                  r"\bcabin sauna", r"\bkilowatt", r"\bkw\b")
_IR_WORDS = _rx(r"infra-?red", r"full[- ]spectrum", r"\bfar[- ]ir\b", r"\bir sauna")
_COLD_WORDS = _rx(r"ice[ _-]?bath", r"chiller", r"cold[ _-]?plunge", r"\bplunge", r"ice[ _-]?tub", r"cold[ _-]?tub")
_HYBRID = _rx(r"hybrid", r"nordic ?wave")


def product_categories(general, interest, specific):
    """Return the subset of PRODUCT_CATEGORIES a call is about (may be empty)."""
    found = set()
    for token in re.split(r"[,\s]+", (general or "").lower()):
        if token in ("traditional_sauna", "heater"):
            found.add(TRADITIONAL)
        elif token == "infrared_sauna":
            found.add(INFRARED)
        elif token in ("ice_bath", "chiller"):
            found.add(COLD)
    text = f"{interest} {specific}".lower()
    if _HYBRID.search(text):
        found.update((TRADITIONAL, INFRARED))
    if not found:
        if _IR_WORDS.search(text):
            found.add(INFRARED)
        if _TRAD_WORDS.search(text):
            found.add(TRADITIONAL)
        if _COLD_WORDS.search(text):
            found.add(COLD)
        for word in re.findall(r"[a-z]+", text):
            if word in _MODEL_CATEGORY:
                found.add(_MODEL_CATEGORY[word])
    return [c for c in PRODUCT_CATEGORIES if c in found]


# --- Reason for the call (one per call) ----------------------------------------

CALL_REASONS = [
    ("After-sales, payments & order queries", _rx(
        r"order status", r"\border\b.*\b(?:update|delay|tracking)", r"delivery (?:update|status|delay|date)", r"tracking",
        r"warrant", r"fault", r"malfunction", r"not working", r"stopped working", r"broken", r"damage", r"repair",
        r"(?:spare|replacement|missing) (?:part|item|piece)", r"issue with (?:the|their|his|her|my) (?:sauna|ice bath|chiller|heater|order|unit)",
        r"error", r"refund", r"assembly (?:help|issue|question)", r"post[- ]purchase", r"existing order",
        r"already (?:purchased|bought|ordered)", r"after[- ]?sales", r"customer service",
        r"(?:customer|technical|product) support", r"support (?:request|call|issue|query)")),
    ("Sale or promotion", _rx(
        r"black friday", r"boxing day", r"cyber monday", r"\beofy\b", r"end of (?:the )?(?:financial )?year",
        r"mother'?s day", r"father'?s day", r"\bsale\b", r"discount", r"promo", r"special offer", r"\bdeal\b(?!-?breaker)",
        r"price (?:drop|reduction)", r"pre-?order (?:price|discount|offer)", r"clearance")),
    ("Sales follow-up on a quote or enquiry", _rx(
        r"follow[- ]?up", r"\bquote", r"previous (?:discussion|call|conversation|inquiry|enquiry|contact)",
        r"call ?back", r"returning (?:a |the |our )?call", r"missed call", r"email (?:inquiry|enquiry)", r"web(?:site)? (?:inquiry|enquiry|form)",
        r"(?:inquiry|enquiry|contact) form", r"submitted", r"abandoned (?:cart|checkout)", r"checkout", r"\bcart\b",
        r"outbound", r"agent (?:call|follow)", r"left (?:a )?(?:voicemail|message)")),
    ("Home renovation or new build", _rx(
        r"renovat", r"new (?:home|house|build|property|place)", r"building (?:a |our |their )?(?:new |a )?(?:home|house)",
        r"\bbuild(?:ing)?\b", r"construction", r"extension", r"landscap", r"backyard", r"back yard", r"\bpool",
        r"outdoor (?:area|space|living|entertain)", r"\bdeck", r"patio", r"garden", r"moving (?:house|home|in)",
        r"moved", r"home improvement", r"bathroom", r"garage", r"granny flat", r"shed")),
    ("Commercial or business project", _rx(
        r"\bgym\b", r"studio", r"clinic", r"\bspa\b", r"airbnb", r"business", r"commercial", r"\bclients?\b",
        r"hotel", r"resort", r"retreat", r"wellness (?:cent|facility|business)", r"physio", r"practice",
        r"franchise", r"facility", r"tender", r"project for", r"\bvenue", r"\bclub\b", r"council", r"school")),
    ("Health, recovery or wellness goal", _rx(
        r"health", r"wellness", r"recover", r"\bpain", r"injur", r"detox", r"sleep", r"relax", r"stress",
        r"contrast", r"cold (?:therapy|exposure|water)", r"therapy", r"doctor", r"arthritis", r"inflamm",
        r"fitness", r"training", r"athlet", r"sport", r"longevity", r"mental", r"anxiety", r"circulation",
        r"skin", r"weight", r"well-being", r"wellbeing", r"muscle", r"immune", r"self[- ]care")),
    ("Recommendation or first-hand experience", _rx(
        r"friend", r"recommend", r"referr", r"word of mouth", r"\btried\b", r"experience (?:at|with|of)",
        r"used (?:one|a sauna|an ice bath)", r"\bsaw (?:one|it|a)\b", r"showroom", r"visit", r"podcast",
        r"influencer", r"social media", r"instagram", r"tiktok", r"facebook", r"youtube", r"\bads?\b",
        r"advert", r"holiday", r"travel", r"overseas", r"finland")),
    ("Upgrading or replacing equipment", _rx(
        r"upgrad", r"replac", r"existing (?:sauna|ice bath|heater|unit)", r"old (?:sauna|heater|unit|ice bath)",
        r"current (?:sauna|ice bath|heater)", r"second (?:sauna|unit)", r"add(?:ing|ition)? (?:to|an?) ")),
    ("Researching and comparing options", _rx(
        r"research", r"compar", r"option", r"interest", r"explor", r"brows", r"looking (?:for|at|into)",
        r"consider", r"curious", r"information", r"enquir", r"inquir", r"purchas", r"buy", r"price", r"pricing",
        r"cost", r"want", r"desire", r"need", r"plan")),
]
OTHER_REASON = "Other / not stated"


def call_reason(stage, direction, trigger, motivation, trigger_secondary="", job=""):
    if stage == "post_purchase":
        return CALL_REASONS[0][0]
    for text in (trigger, f"{trigger} {trigger_secondary} {motivation}"):
        if not text.strip():
            continue
        for label, rx in CALL_REASONS:
            if rx.search(text):
                return label
    if direction == "O":
        return "Sales follow-up on a quote or enquiry"  # the rep rang them, and no other reason was given
    for label, rx in CALL_REASONS:
        if job and rx.search(job):
            return label
    return OTHER_REASON


# --- What the customer asked about (several per call) ---------------------------

CUSTOMER_REQUESTS = [
    ("Price or quote", _rx(
        r"how much", r"what(?:'s| is| are| would| will) (?:the |your |that )?(?:price|cost)", r"\bquote\b", r"pricing",
        r"price (?:of|for|on)", r"cost (?:of|for|me|us)", r"what does (?:it|that|this) cost", r"\bprice\b\?")),
    ("Discounts, sales or a better price", None),  # filled from the pricing detector
    ("Product advice & comparison", _rx(
        r"difference between", r"what(?:'s| is) the difference", r"\bcompar", r"\bversus\b", r"\bvs\.?\b",
        r"which (?:one|model|sauna|size|heater|chiller)", r"what would you (?:recommend|suggest)", r"recommend",
        r"better (?:for|option|choice)", r"pros and cons", r"best (?:one|option|model)", r"suit (?:me|us|my)")),
    ("Electrical & power requirements", _rx(
        r"\bamps?\b", r"\bamp\b", r"electric", r"power point", r"powerpoint", r"\bplug", r"outlet", r"circuit",
        r"wiring", r"hard ?wire", r"single[- ]phase", r"three[- ]phase", r"3[- ]phase", r"kilowatt", r"\bkw\b",
        r"\b(?:10|15|20|32) ?amp", r"\bvolt", r"breaker", r"switchboard")),
    ("Installation & site prep", _rx(
        r"install", r"assembl", r"put (?:it )?together", r"set (?:it )?up", r"\bclearance", r"foundation",
        r"\bslab\b", r"concrete", r"\bbase\b", r"level ground", r"pavers?", r"\broof", r"weather ?proof",
        r"ventilat")),
    ("Stock & lead times", _rx(
        r"in stock", r"\bstock\b", r"(?:is|are|be) (?:it|they|that|those|these|this|the [\w ]{1,20}) (?:still |currently )?available",
        r"availability", r"pre-?order", r"back in", r"sold out", r"lead time", r"\beta\b",
        r"when (?:will|would|can|could) (?:it|they|i|we) (?:be|get|have|arrive)", r"how (?:long|soon) (?:until|before) (?:it|they|we|i)\b",
        r"how long (?:will|would) (?:it|delivery|shipping) take to (?:arrive|get|come|ship|deliver)",
        r"new model", r"(?:when|does|will|did) (?:it|they|the [\w ]{1,20}) come out", r"release")),
    ("Delivery & freight", _rx(
        r"deliver", r"shipping", r"freight", r"courier", r"tail ?lift", r"\bcrane", r"\bpallet", r"forklift",
        r"truck", r"pick ?up", r"collect")),
    ("Size, space & fit", _rx(
        r"dimension", r"measure", r"how big", r"\bfit\b", r"footprint", r"ceiling", r"\bheight\b", r"\bwidth\b",
        r"\bdepth\b", r"how (?:tall|wide|deep)", r"\bsize\b", r"(?:millimet|centimet|met)res?\b", r"\bmm\b",
        r"how many (?:people|person)")),
    ("Finance & payment options", _rx(
        r"financ", r"afterpay", r"\bzip\b", r"zip ?pay", r"zip ?money", r"humm", r"latitude", r"payment plan",
        r"interest[- ]free", r"\bdeposit", r"lay-?by", r"instal?ments", r"pay (?:it )?(?:off|monthly|weekly)",
        r"credit card", r"bank transfer", r"invoice")),
    ("Running costs & maintenance", _rx(
        r"running cost", r"cost to run", r"electricity (?:bill|cost|usage)", r"power (?:bill|usage|consumption)",
        r"maintenance", r"maintain", r"clean", r"care (?:for|of) (?:it|the|them)", r"aftercare", r"\boil\b", r"treat(?:ment|ing)? the (?:timber|wood)",
        r"water change", r"change the water", r"filter", r"saniti", r"chlorine", r"ozone", r"\buv\b", r"how long (?:does|will) (?:it|they) last")),
    ("Showroom visit", _rx(
        r"showroom", r"come (?:in|down|by) (?:to|and)", r"come and (?:see|have a look)", r"see (?:it|one|them) in person", r"\bdisplay",
        r"\bvisit", r"pop (?:in|down)", r"have a look at (?:it|one|them)", r"try (?:it|one) out", r"warehouse")),
    ("Order status & after-sales help", _rx(
        r"order number", r"my order", r"tracking", r"\btrack (?:it|my|the order)", r"warrant", r"\bfault", r"not working",
        r"stopped working", r"broken", r"error", r"repair", r"replacement part", r"missing (?:part|piece|item)", r"damaged", r"refund",
        r"\breturn\b", r"invoice number")),
    ("Health benefits & usage", _rx(
        r"benefit", r"health", r"how often", r"how long should", r"temperature", r"degrees", r"detox",
        r"recovery", r"is it safe", r"pregnan", r"blood pressure", r"\bheart\b", r"doctor", r"inflamm", r"sleep",
        r"\bemf\b")),
]
REQUEST_LABELS = [label for label, _ in CUSTOMER_REQUESTS]


def customer_requests(customer_text, extra_text, asked_for_price_break):
    """customer_text: the customer's own words. extra_text: AI notes on what was missing or asked."""
    found = []
    for label, rx in CUSTOMER_REQUESTS:
        if rx is None:
            if asked_for_price_break:
                found.append(label)
        elif rx.search(customer_text) or (extra_text and rx.search(extra_text)):
            found.append(label)
    return found


# --- Why a sales call did not close (one per call) ------------------------------

NOT_CLOSED_REASONS = [
    ("Couldn't reach the customer", _rx(
        r"voicemail", r"no response", r"unable to (?:reach|contact|connect)", r"unavailable", r"no answer",
        r"did(?:n't| not) answer", r"not answer", r"no contact", r"call (?:dropped|cut|disconnected)", r"disconnect",
        r"hung up", r"bad (?:line|connection|reception)", r"no (?:customer )?interaction", r"wrong number",
        r"could(?:n't| not) hear", r"busy", r"driving", r"call back later", r"not a good time")),
    ("Lost to a competitor", _rx(
        r"competitor", r"bought (?:one )?elsewhere", r"went with (?:another|a different|someone)",
        r"purchased (?:from )?(?:another|elsewhere|a different)", r"chose (?:another|a competitor)", r"lost to")),
    ("Price or budget", _rx(
        r"price", r"budget", r"cost", r"afford", r"expensive", r"financ", r"cheaper", r"discount", r"money",
        r"\bdeal\b(?!-?breaker)", r"\bsale\b", r"payment", r"funds", r"spend", r"black friday", r"value", r"\bfee", r"pricing")),
    ("Needs partner or decision-maker", _rx(
        r"partner", r"\bwife", r"husband", r"spouse", r"family", r"decision[- ]maker", r"discuss with",
        r"consult (?:with )?(?:his|her|their|the)", r"\bboss", r"board", r"\bmum\b", r"\bdad\b", r"management",
        r"other stakeholder", r"approval from", r"talk (?:it )?(?:over|through) with")),
    ("Waiting on renovation, build or approvals", _rx(
        r"council", r"strata", r"body corporate", r"landlord", r"approval", r"builder", r"architect",
        r"designer", r"(?:building|house|floor|site) plans", r"permit", r"landscap", r"renovat", r"construction",
        r"new (?:build|home|house)", r"house (?:build|construction)", r"\bbuild (?:is|to be|being)", r"(?:the|their|his|her) build")),
    ("Electrical requirements", _rx(
        r"electric", r"\bpower", r"\bamps?\b", r"wiring", r"circuit", r"phase", r"outlet", r"switchboard",
        r"\bplug")),
    ("Space or fit", _rx(
        r"space", r"\bfit\b", r"size", r"measure", r"dimension", r"\broom\b", r"height", r"footprint",
        r"access", r"ceiling", r"\bwidth")),
    ("Stock or availability", _rx(
        r"stock", r"availab", r"pre-?order", r"lead time", r"new model", r"next model", r"launch", r"release",
        r"\beta\b", r"sold out", r"back in", r"arriv")),
    ("Delivery or installation logistics", _rx(
        r"deliver", r"shipping", r"freight", r"install", r"assembl", r"logistic", r"crane", r"\bsite\b", r"slab",
        r"\bbase\b", r"transport", r"location")),
    ("Waiting on info or a quote from us", _rx(
        r"await(?:ing)? (?:a |the |further |more )?(?:quote|information|info|details|spec|email|response from (?:us|consultant|agent|sales))",
        r"(?:waiting for|awaiting) (?:a )?call ?back with", r"after receiving (?:more )?(?:information|info|details|a quote|the quote)",
        r"pending (?:more )?(?:information|info|details|quote)", r"awaiting confirmation from (?:the )?(?:sales|agent|rep|team)",
        r"(?:send|sent|sending|provide|email) (?:a |the |them |him |her )?(?:quote|information|details|specs|brochure|link)",
        r"waiting (?:for|on) (?:a |the |our )?(?:quote|email|info|information|details|specs|consultant|call ?back from)",
        r"consultant", r"specification", r"more information from", r"follow[- ]up (?:from|by) (?:us|agent|sales|the team)",
        r"agent to", r"escalat", r"transfer")),
    ("Product didn't fit their needs", _rx(
        r"wrong fit", r"not suitable", r"unsuitable", r"does(?:n't| not) suit", r"not the right", r"not what",
        r"product fit", r"did(?:n't| not) meet", r"does(?:n't| not) (?:offer|have|stock|sell)",
        r"do(?:n't| not) (?:offer|have|stock|sell)", r"not available in", r"outdoor (?:use|suitab)", r"customi")),
    ("Wants to see it first / trust", _rx(
        r"showroom", r"see (?:it|one|the product|them) in person", r"\bvisit", r"trust", r"review", r"reputation",
        r"quality", r"confiden", r"warranty", r"touch and feel", r"\bsample")),
    ("Timing - not ready yet", _rx(
        r"timing", r"not ready", r"later", r"future", r"next (?:year|month|few)", r"months", r"weeks",
        r"after (?:the|their|his|her)", r"when (?:the|their|his|her)", r"\btime\b", r"christmas", r"holiday", r"moving",
        r"settle", r"not (?:in a )?(?:rush|hurry)", r"long[- ]term", r"eventual", r"down the track", r"early stage")),
    ("Committed - completing the order later", _rx(
        r"will (?:purchase|order|buy|pay|complete)", r"finali[sz]e (?:the |their |his |her )?(?:purchase|order)",
        r"place (?:the |an |their |his |her )?order", r"proceed (?:with )?(?:the |their )?(?:order|purchase|payment)",
        r"(?<!not )ready to (?:buy|purchase|order|proceed|pay)", r"plans? to (?:buy|purchase|order|pay)", r"going to (?:buy|purchase|order)",
        r"agreed to (?:purchase|buy|order|proceed|pay)", r"intent(?:ion)? to (?:buy|purchase|order)", r"order online", r"purchase online", r"decided to (?:buy|purchase|go with)",
        r"deposit", r"intends to (?:buy|purchase|order)")),
    ("Still researching or comparing", _rx(
        r"compar", r"research", r"consider", r"options", r"decid", r"think", r"undecided", r"evaluat",
        r"gather", r"more information", r"more info", r"brows", r"explor", r"look(?:ing)? around", r"not sure",
        r"unsure", r"shopping around", r"interest", r"information")),
    ("Follow-up pending", _rx(
        r"await", r"call ?back", r"get back", r"follow[- ]?up", r"will (?:call|contact|email|reach)", r"pending",
        r"next step", r"to (?:call|email|contact)", r"waiting (?:for|on) (?:the )?customer")),
]
OTHER_NOT_CLOSED = "Other / unclear"

_BARRIER_TYPE_FALLBACK = {
    "financial": "Price or budget", "electrical": "Electrical requirements", "space": "Space or fit",
    "time": "Timing - not ready yet", "confidence": "Still researching or comparing",
    "support": "Waiting on info or a quote from us", "availability": "Stock or availability",
    "product": "Product didn't fit their needs", "product_fit": "Product didn't fit their needs",
}

# Outcomes that count as a sales conversation that ended without a sale.
NOT_CLOSED_OUTCOMES = {"strong_intent", "moderate_interest", "low_interest", "wrong_fit", "lost_to_competitor"}


def not_closed_reason(outcome, outcome_reason, objections, barrier, barrier_type):
    if outcome == "lost_to_competitor":
        return "Lost to a competitor"
    if outcome == "wrong_fit":
        for label, rx in NOT_CLOSED_REASONS[:3]:
            if rx.search(outcome_reason or ""):
                return label
        return "Product didn't fit their needs"
    for text in (outcome_reason, objections, barrier):
        text = (text or "").strip()
        if not text or text.lower() in ("none", "n/a", "na"):
            continue
        for label, rx in NOT_CLOSED_REASONS:
            if rx.search(text):
                return label
    return _BARRIER_TYPE_FALLBACK.get((barrier_type or "").strip().lower(), OTHER_NOT_CLOSED)
