"""Which needs-discovery questions the sales rep asked on a call.

Reads the rep's own lines in the transcript ("internal:") and looks for
questions on each discovery topic: where the unit will go, how many people,
what it's for, budget, timeframe and so on. A line counts when it is phrased
as a question (has a "?" or opens with a question word) and matches a topic.
The first matching question per topic is kept as an example.
"""
import re


def _rx(*patterns):
    return re.compile("|".join(patterns), re.I)


# (short label, longer description, pattern). Order is the usual discovery flow.
TOPICS = [
    ("Purpose", "What it's for: health, recovery, relaxation, home or business", _rx(
        r"what (?:are|were|is|was) (?:you|it) (?:mainly |primarily |actually )?(?:looking|hoping|wanting|planning) (?:to )?(?:use|get|achieve)",
        r"what (?:are|were) you (?:wanting|looking|hoping) to get out of", r"what(?:'s| is) (?:it|the sauna|the ice bath|this) (?:mainly |going to be )?for\b",
        r"(?:main|primary) (?:reason|goal|purpose)", r"what (?:got|brought) you (?:into|interested)", r"what(?:'s| is) (?:your|the) (?:goal|reason|purpose)",
        r"recovery or relaxation", r"relaxation or recovery", r"(?:use|using) (?:it|the sauna|the ice bath) for\b", r"what (?:are|were) you after",
        r"\bfor (?:recovery|relaxation|wellness|health|detox|training)\b.*\?", r"commercial or (?:home|residential|personal)", r"(?:home|personal) or commercial",
        r"why (?:a sauna|an ice bath|are you looking)", r"benefits (?:are|were) you (?:after|looking)")),
    ("Space", "Where it will go: indoor or outdoor, space available", _rx(
        r"\bindoors? or outdoors?", r"\boutdoors? or indoors?", r"inside or outside", r"outside or inside",
        r"where (?:are|were|would|will) you (?:looking |thinking |planning |wanting |hoping )?(?:to )?(?:put|place|install|have|set|position|locate)",
        r"where(?:abouts)? (?:is|would|will) (?:it|the sauna|the ice bath|this) (?:go|be going|sit|be)", r"how much (?:space|room)",
        r"what(?:'s| is) the (?:space|area|room|footprint)", r"(?:measure|measurements|dimensions) of (?:the|your) (?:space|area|room)", r"under ?cover",
        r"(?:outdoor|indoor) (?:area|space)\b.*\?")),
    ("People", "How many people will use it, and their height for fit", _rx(
        r"how many (?:people|person|users)", r"how tall (?:are you|is)", r"(?:just|only) (?:for )?(?:you|yourself)(?: or|\?| using| in it)", r"\b(?:one|two|three|four)[- ]person or",
        r"(?:who|how many) (?:will|would|is going to) (?:be )?us(?:e|ing)", r"anyone else (?:using|use)")),
    ("Experience", "Sauna experience and infrared vs traditional preference", _rx(
        r"have you (?:ever )?(?:used|tried|been in|owned|had) (?:a |an )?(?:sauna|ice bath|infrared|traditional|cold plunge|one)",
        r"infrared or traditional", r"traditional or infrared", r"(?:prefer|preference)\b.*\?", r"familiar with", r"how hot do you")),
    ("Electrical", "Power supply: 10 or 15 amp, electrician, hard-wiring", _rx(
        r"(?:15|fifteen|10|ten|32) ?amp", r"\bpower ?point", r"\boutlet", r"electrician", r"(?:power|electrical) (?:supply|setup|set up|situation|available)",
        r"single phase|three phase|3 phase", r"hard ?wire", r"switchboard", r"circuit")),
    ("Install & site", "What it sits on and whether they want installation", _rx(
        r"(?:concrete|slab|pavers|deck|decking) ?(?:base|surface|area)?\b.*\?", r"what (?:will|would) (?:it|the sauna|the ice bath) (?:sit|be sitting) on",
        r"(?:level|flat) (?:ground|surface|base)", r"install(?:ing|ation)? (?:it )?yourself", r"(?:need|want|like) (?:help with |us to )?install",
        r"installation (?:added|included|as well)\b.*\?", r"build it yourself", r"handy")),
    ("Timeframe", "When they want it", _rx(
        r"when (?:are|were|would|will|do) you (?:looking|hoping|planning|wanting|thinking|need|like|after)", r"time ?frame", r"timeline", r"how soon",
        r"by christmas\b.*\?", r"when (?:do|would) you (?:need|want) (?:it|that|them)")),
    ("Budget", "Budget or price range", _rx(
        r"\bbudget", r"price range", r"how much (?:are|were) you (?:looking|wanting|hoping|thinking) to (?:spend|invest)",
        r"(?:what|how much) (?:did you|do you|were you) (?:want|plan|have in mind) to spend", r"ballpark")),
    ("Decision-makers", "Who else is involved in the decision", _rx(
        r"(?:partner|wife|husband|other half|missus|spouse)\b.*\?", r"anyone else (?:involved|deciding|you need)",
        r"decision[- ]?makers?", r"(?:make|making) (?:the |this |that )?decision (?:together|with|on your own)", r"who (?:else )?(?:is|will be|would be) (?:making|involved)",
        r"(?:discuss|chat|talk) (?:it |this |that )?(?:with|over)\b.*\?")),
    ("Other brands", "Other brands or quotes they are considering", _rx(
        r"(?:looked at|looking at|considering|comparing|seen) (?:any )?(?:other|others|other brands|other companies|anyone else|elsewhere)",
        r"other (?:brands|companies|options) (?:you|you've|are you)", r"who else (?:are|have|did) you", r"who (?:did|have) you (?:get|got|had) (?:a |the |any )?quotes?",
        r"quotes? (?:through|from) (?:anyone|anywhere|other|elsewhere|someone)", r"(?:any|other) quotes\b.*\?")),
    ("Location", "Where they are, for delivery and access", _rx(
        r"where (?:are|abouts are) you (?:located|based|from)", r"whereabouts are you", r"what(?:'s| is) (?:your|the) (?:postcode|post code|suburb)",
        r"what (?:suburb|postcode|area)", r"(?:side|gate|good|easy|clear) access", r"stairs\b.*\?")),
    ("How they found us", "How they heard about Revel", _rx(
        r"how did you (?:hear|find|come across)", r"where did you (?:hear|find|see) (?:about )?us", r"what brought you to (?:us|revel)", r"found us")),
]
TOPIC_LABELS = [t[0] for t in TOPICS]
TOPIC_DESCRIPTIONS = {t[0]: t[1] for t in TOPICS}
_QUESTION_START = re.compile(r"\s*(?:so |and |okay |ok |yeah |right |cool |great |perfect |awesome |alright )*"
                             r"(?:what|what's|where|whereabouts|when|how|have|has|do|did|does|are|is|would|will|who|which|can|could|were)\b", re.I)
# Questions about Revel's own earlier quote are follow-ups, not discovery about other brands.
_OUR_QUOTE = re.compile(r"quote (?:from|with|through) (?:us|ourselves|revel)|our quote", re.I)


def asked(call_turns):
    """{topic label: first question the rep asked on it} for one call."""
    found = {}
    for speaker, text in call_turns:
        if speaker != "internal" or not ("?" in text or _QUESTION_START.match(text)):
            continue
        for label, _, rx in TOPICS:
            if label in found or not rx.search(text):
                continue
            if label == "Other brands" and _OUR_QUOTE.search(text):
                continue
            found[label] = text
    return found
TOPIC_RX = {t[0]: t[2] for t in TOPICS}
