"""Keyword rules that read a service conversation: what the problem was, what the
rep did about it, how the call ended and how the customer's mood moved.

Used for both Aircall calls (customer and rep lines of the transcript) and
HubSpot tickets (subject, claim form fields and the first email). Each issue,
solution and component is a list of patterns; a text scores one point per
pattern it matches, so a long transcript can't win just by repeating a word.
"""
import re


def _rx(*patterns):
    return [re.compile(p, re.I) for p in patterns]


def hits(rxs, text):
    return sum(1 for rx in rxs if rx.search(text)) if text else 0


# --- Issues (shared by calls and tickets) ----------------------------------------
# Order matters only to break ties: specific faults come before general buckets.

ISSUES = [
    ("Ice bath chiller & cooling", _rx(
        r"\bchiller", r"not (?:getting |going |staying )?(?:cold|cool)\b", r"\bnot (?:cooling|chilling)", r"won'?t (?:cool|chill|get cold)",
        r"\bcompressor", r"\blow flow", r"\bflow (?:rate|error|alarm|switch|sensor|issue|problem|fault)", r"litres? (?:per|a) minute",
        r"\bpump\b", r"\bcooling\b", r"\brefrigerant", r"\bice (?:building|forming|build ?up)", r"\bfreez(?:ing|es) (?:up|over)",
        r"\bwater temp(?:erature)?\b", r"\bcold plunge (?:isn'?t|is not|not)")),
    ("Sauna heater & temperature", _rx(
        r"\bheaters?\b", r"not (?:getting |going )?(?:hot|warm)\b", r"\bnot heating", r"won'?t (?:heat|get hot|warm up)",
        r"\bheat(?:ing)? (?:up )?(?:issue|problem|slowly|time)", r"\belements?\b", r"\bsauna stones?\b", r"\b(?:the )?(?:stones|rocks)\b",
        r"\bthermostat", r"\btemp(?:erature)? (?:sensor|probe)", r"\bsensor\b", r"\bprobe\b", r"\bover ?heat",
        r"\b(?:infrared|ir|carbon|heating) panels?\b", r"\bcylindro", r"\bonly (?:gets?|getting|reaching|reaches) (?:to |up to )?\d+")),
    ("Electrical, power & tripping", _rx(
        r"\btrip(?:s|ping|ped)?\b", r"\brcd\b", r"\bsafety switch", r"\bbreakers?\b", r"\bfuses?\b", r"\bwir(?:e|es|ing)\b",
        r"\belectrician", r"\b(?:10|15|20|32|ten|fifteen|twenty|thirty[- ]two) ?amps?\b", r"\bhard ?wir", r"\bpower (?:supply|point|issue|problem|cable|cord|outlet)",
        r"\bno power\b", r"\bwon'?t (?:turn|switch|power) on", r"\bnot (?:turning|switching|powering) on", r"\bcontactor",
        r"\b(?:single|three|3)[- ]phase", r"\bextension (?:lead|cord)", r"\bterminals?\b", r"\belectrical",
        r"\b(?:isn'?t|aren'?t|not) (?:turning|switching|powering) on", r"\bturn(?:s|ing)? (?:it ?self|themselves) off", r"\bcuts? out\b")),
    ("Controls, app & Wi-Fi", _rx(
        r"control (?:panel|unit|box|board|pad)", r"\bcontroller\b", r"\bxenio", r"\bdisplay\b", r"\bscreen\b", r"\bkeypad",
        r"\btouch ?(?:pad|panel|screen)", r"\bthe app\b", r"\bapp (?:isn'?t|is not|won'?t|doesn'?t|not)", r"\bwi-?fi\b", r"\bremote\b", r"\btimer\b",
        r"\berror (?:code|message)", r"\b(?:e|er|ee|f|p) ?\d{1,2}\b", r"\bsettings?\b", r"\bbuttons?\b", r"\bpairing\b", r"\bfirmware|\bsoftware")),
    ("Cleaning, water care & maintenance", _rx(
        r"\bmaintenance", r"\bmaintain", r"\bclean(?:ing)? (?:routine|the sauna|the timber|the glass)", r"\b(?:timber|wood) (?:oil|treatment|care)",
        r"\bfilters?\b", r"\bozone", r"\buv\b", r"\bsanitis|\bsanitiz", r"\bchlorine", r"\bcloudy", r"\bgreen water", r"\balgae",
        r"\bslim(?:e|y)\b", r"\bsmell", r"\bclean(?:ing)? (?:the )?(?:water|tub|ice bath|chiller)", r"\bwater (?:quality|change|treatment|care|chemistry)",
        r"\bchange the water", r"\bdrain(?:ing)?\b", r"\bo-?rings?\b", r"\bhydrogen peroxide", r"\bspa (?:chemicals?|treatment)", r"\bph\b")),
    ("Leaks, timber, doors & glass", _rx(
        r"\bleak", r"\bcrack", r"\bsplit(?:ting)?\b", r"\bwarp", r"\bdoors?\b", r"\bglass\b", r"\bhinges?\b", r"\blatch", r"\bhandles?\b",
        r"\broof", r"\bshingles?\b", r"\bmou?ld(?:y)?\b", r"\brot(?:ting|ten)?\b", r"\btimber\b", r"\bwood(?:en)?\b", r"\bseal(?:ant|ing|s)?\b",
        r"\bwaterproof", r"\bbench(?:es)?\b", r"\bbackrest", r"\bstain(?:ing|ed)?\b", r"\binsulation")),
    ("Lights, sound & accessories", _rx(
        r"\bled\b", r"\blights?\b", r"\blighting", r"\bchromo", r"\bstar ?lights", r"\bfairy lights", r"\bspeakers?\b", r"\bsound system",
        r"\bbluetooth", r"\bheadrest", r"\bcovers?\b", r"\blids?\b", r"\bsteps\b", r"\bladder", r"\bbucket", r"\bladle", r"\baccessor")),
    ("Damaged, missing or wrong items", _rx(
        r"\bdamaged?\b", r"\bdent(?:ed|s)?\b", r"\bscratch", r"\barrived (?:broken|damaged|cracked)", r"\bbroken (?:on|in) (?:arrival|delivery|transit)",
        r"\bmissing\b", r"\bwrong (?:item|part|model|colou?r|size|one|product)", r"\bnot (?:included|in the box)", r"\bincomplete\b",
        r"\bboxes? (?:was|were|is) (?:damaged|crushed|wet|open)")),
    ("Delivery delay & tracking", _rx(
        r"\btracking", r"\btrack (?:my|the|it)", r"\bwhere(?:'s| is) my (?:order|sauna|ice bath|delivery)", r"\beta\b", r"\bdelay",
        r"\bback ?order", r"\bpre-?order", r"\bhasn'?t (?:arrived|come|been delivered|shipped)", r"\bnot (?:arrived|delivered|here) yet",
        r"\bstill (?:waiting|not here|hasn'?t)", r"\blate\b", r"\bwhen (?:will|is) (?:it|my order|the order|my sauna|my ice bath) (?:arriv|com|be deliver|ship)",
        r"\bupdate on (?:my|the) (?:order|delivery)", r"\bmissed (?:the )?delivery", r"\bconsignment",
        r"\bwhen (?:will|is|would) (?:it|this|my order|the order|they)(?: be| getting)? (?:sent|shipped|dispatched|sent out)",
        r"\b(?:has|have) (?:this|it|my order|the order|they) (?:been )?(?:sent|shipped|dispatched)", r"\bgetting (?:shipped|sent|dispatched)",
        r"\bwhen (?:it|this) will be (?:sent|shipped|dispatched)")),
    ("Delivery booking & logistics", _rx(
        r"\bdeliver", r"\bcouriers?\b", r"\bfreight", r"\bshipping", r"\bdispatch", r"\barriv", r"\bwinnings?\b", r"\btoll\b",
        r"\bresched", r"\bbook(?:ing)? (?:in )?(?:a |the )?(?:delivery|time|date|slot)", r"\bdriver", r"\btail ?lift", r"\bpallet",
        r"\bstairs\b", r"\bdriveway", r"\baccess\b", r"\bpick ?up\b", r"\bcollect(?:ion)?\b", r"\bwarehouse", r"\btwo[- ]person")),
    ("Assembly & installation", _rx(
        r"\bassembl", r"\binstall", r"\bput (?:it |them )?together", r"\bset ?up\b", r"\bsetting up", r"\binstructions?\b", r"\bmanuals?\b",
        r"\bscrews?\b", r"\bbolts?\b", r"\bbrackets?\b", r"\blevel(?:ling)?\b", r"\bslab\b", r"\bfoundation", r"\bplacement\b", r"\bclearance")),
    ("Spare & replacement parts", _rx(
        r"\bspare", r"\breplacement (?:part|parts|unit|piece)", r"\bnew (?:part|parts|piece)\b", r"\bpart (?:number|no)\b",
        r"\border (?:a |some )?(?:new )?parts?\b", r"\bparts? (?:order|request|quote|enquiry|inquiry)")),
    ("Faulty unit / warranty (general)", _rx(
        r"\bwarrant", r"\bfaulty", r"\bdefect", r"\bfault\b", r"\bnot working", r"\bstopped working", r"\bdoesn'?t work", r"\bmalfunction",
        r"\bbroken\b", r"\brepair")),
    ("Returns, refunds & cancellations", _rx(
        r"\brefund", r"\breturn(?:ing|ed|s)?\b", r"\bcancel", r"\bchange of mind", r"\bexchange\b", r"\bmoney back", r"\bchargeback", r"\bdispute")),
    ("Payments, invoices & finance", _rx(
        r"\binvoice", r"\bpayments?\b", r"\bpaid\b", r"\bpay (?:for|the|off|it)", r"\breceipt", r"\bfinanc", r"\bafterpay", r"\bzip ?pay\b",
        r"\bhumm\b", r"\bdeposit", r"\bbalance\b", r"\bremittance", r"\bbank transfer", r"\bcredit card", r"\boutstanding")),
    ("Usage & health advice", _rx(
        r"\bhow long (?:should|do|can|to stay)", r"\bhow often", r"\bwhat temp", r"\bhow (?:hot|cold) (?:should|does|can)", r"\bemf\b",
        r"\bpregnan", r"\bhealth (?:benefits?|condition)", r"\bbenefits?\b", r"\bprotocol", r"\bhow to use", r"\bis it safe")),
    ("Order changes & admin", _rx(
        r"\bchange (?:my|the|of) (?:order|address|delivery address|model|colou?r)", r"\bupgrade (?:my|the) order", r"\badd (?:to|an item|it to) (?:my|the) order",
        r"\border (?:confirmation|number|details|status)", r"\bupdate (?:my|the) (?:address|details|order)", r"\bconfirm(?:ing|ation)? (?:my|the|of) order",
        r"\bredirect", r"\bnew address", r"\bmov(?:ed|ing) (?:house|home)")),
    ("Pre-sale & product questions", _rx(
        r"\bprice\b", r"\bpricing", r"\bquote (?:for|on)", r"\bhow much", r"\bdimensions?\b", r"\bdiscount", r"\binterested in (?:buying|purchasing|a|the|your)",
        r"\blooking (?:to buy|at buying|to purchase|for a)", r"\bdo you (?:sell|have|stock|offer|ship|deliver to)", r"\bin stock\b", r"\bshowroom",
        r"\bwould like to (?:buy|purchase|order)", r"\bdifference between", r"\bwhich (?:model|one|sauna|ice bath) (?:would|should|is)")),
]
ISSUE_LABELS = [label for label, _ in ISSUES]
OTHER_ISSUE = "Other / unclear"
ADMIN_NOTICE = "Automated or internal email"

# Ticket subjects that are system mail, not a customer problem.
_NOTICE = re.compile(
    r"^(?:re: |fw: |fwd: )*(?:automatic reply|auto(?:matic)?[- ]reply|out of office|undeliverable|delivery status notification|"
    r"accepted:|declined:|invitation:|updated invitation|payout for|.*remittance|.*sent you .* via wetransfer|.*import finished|"
    r".*export finished|po notice|drop ship po|.*has been received!?$|.*aircall new ticket|new order$|.*is delivered$)", re.I)


# Delay signals are fewer and more specific than general booking talk, so they count more.
ISSUE_WEIGHT = {"Delivery delay & tracking": 1.5}


def classify_issue(headline, body, extra=""):
    """Primary issue and all issues raised. headline counts 3x (AI summary, ticket subject)."""
    scores = []
    for i, (label, rxs) in enumerate(ISSUES):
        s = (3 * hits(rxs, headline) + hits(rxs, body) + 0.5 * hits(rxs, extra)) * ISSUE_WEIGHT.get(label, 1)
        if s:
            scores.append((s, -i, label))
    if not scores:
        return OTHER_ISSUE, []
    scores.sort(reverse=True)
    top = scores[0][0]
    primary = scores[0][2]
    # Secondary issues: reasonably strong on their own, not just one passing word.
    others = [label for s, _, label in scores[1:] if s >= max(2, top * 0.5)][:3]
    return primary, others


def is_notice(subject):
    return bool(_NOTICE.match((subject or "").strip()))


# --- Revel models and components ---------------------------------------------------

MODELS = [
    ("Glacier", r"\bglacier"), ("Arctic", r"\barctic\b"), ("Freeze", r"\bfreeze\b"),
    ("Aura", r"\baura\b"), ("Nova", r"\bnova\b"), ("Luna", r"\blunar?\b"), ("Eclipse", r"\beclipse\b"),
    ("Kora", r"\b[ck]ora\b"), ("Nordic Wave", r"\bnordic(?: ?wave)?\b"), ("Tampere", r"\btamper[ea]?\b"),
    ("Edenview", r"\beden ?view\b"), ("Eden", r"\beden\b(?! ?view)"), ("Solaris", r"\bsolaris\b"), ("Loom", r"\bloom\b"),
    ("Verta", r"\b(?:verta|virta|verda)\b"), ("Aurora", r"\baurora\b"),
]
_MODEL_RX = [(name, re.compile(p, re.I)) for name, p in MODELS]


def models(text):
    return [name for name, rx in _MODEL_RX if rx.search(text or "")]


COMPONENTS = [
    ("Heater", _rx(r"\bheaters?\b", r"\bcylindro")), ("Heating elements", _rx(r"\belements?\b")),
    ("Sauna stones", _rx(r"\bstones\b", r"\brocks\b")), ("Infrared panels", _rx(r"\b(?:infrared|ir|carbon|heating) panels?\b")),
    ("Temp sensor / thermostat", _rx(r"\bsensor\b", r"\bprobe\b", r"\bthermostat")),
    ("Control panel / controller", _rx(r"control (?:panel|unit|box|board|pad)", r"\bcontroller\b", r"\bkeypad", r"\bdisplay\b", r"\bxenio")),
    ("App, Wi-Fi & remote", _rx(r"\bthe app\b", r"\bwi-?fi\b", r"\bremote\b", r"\bbluetooth")),
    ("Chiller unit", _rx(r"\bchiller")), ("Compressor", _rx(r"\bcompressor")), ("Pump & flow", _rx(r"\bpump\b", r"\bflow\b")),
    ("Filter", _rx(r"\bfilters?\b")), ("Ozone / UV", _rx(r"\bozone", r"\buv\b")),
    ("Hoses & fittings", _rx(r"\bhoses?\b", r"\bfittings?\b", r"\bvalves?\b", r"\bo-?rings?\b")),
    ("Door & glass", _rx(r"\bdoors?\b", r"\bglass\b", r"\bhinges?\b", r"\blatch", r"\bhandles?\b")),
    ("Roof & shingles", _rx(r"\broof", r"\bshingles?\b")), ("Bench & backrest", _rx(r"\bbench(?:es)?\b", r"\bbackrest")),
    ("Timber & seals", _rx(r"\btimber\b", r"\bwood(?:en)?\b", r"\bseals?\b", r"\bsealant")),
    ("Lights", _rx(r"\bled\b", r"\blights?\b", r"\bchromo")), ("Speakers", _rx(r"\bspeakers?\b")),
    ("Cover & lid", _rx(r"\bcovers?\b", r"\blids?\b")), ("Power cable & plug", _rx(r"\bplug\b", r"\bpower (?:cable|cord|lead)", r"\bextension")),
    ("RCD, breaker & fuse", _rx(r"\brcd\b", r"\bsafety switch", r"\bbreakers?\b", r"\bfuses?\b", r"\btrip(?:s|ping|ped)?\b")),
]
COMPONENT_LABELS = [label for label, _ in COMPONENTS]


def components(text):
    return [label for label, rxs in COMPONENTS if hits(rxs, text)]


# --- What the rep did (calls) -------------------------------------------------------

SOLUTIONS = [
    ("Troubleshot on the call", _rx(
        r"\b(?:turn|switch|power) (?:it |that |everything |the \w+ )?(?:off|on) (?:and|at the wall|again)", r"\breset\b", r"\brestart",
        r"\bunplug", r"\bpower cycle", r"\bhold (?:down )?(?:the|that|it|both)", r"\bpress (?:and hold|the|that|both)",
        r"\bcheck (?:the|your|that|if|whether) (?:breaker|rcd|safety switch|switch|filter|setting|fuse|connection|cable|plug|hose|pump|valve|wiring|sensor|probe|display|app|wi-?fi|water level)",
        r"\bfactory reset", r"\bre-?pair", r"\bclean (?:the|out the) filter", r"\bprim(?:e|ing) (?:the )?pump", r"\bbleed", r"\bair ?lock",
        r"\btry (?:that|it|turning|switching|resetting|unplugging|pressing|holding)", r"\bcan you (?:see|check|try|press|hold|turn|switch|look)")),
    ("Explained how it works", _rx(
        r"\bwhat you (?:need to|want to|have to|can|should) do", r"\bthe way (?:it|that|they) works?", r"\bthat'?s (?:normal|completely normal|expected|how it)",
        r"\bit'?s (?:normal|meant to|supposed to|designed to)", r"\byou (?:just )?(?:need|have|want) to (?:set|turn|press|hold|use|leave|let|make sure|wait)",
        r"\bmake sure (?:you|that|it|the)", r"\bset (?:it|the temperature|the timer) to", r"\b(?:it|that) (?:should|will) (?:take|get|heat|cool|reach)",
        r"\bin the manual", r"\bthe manual (?:says|shows|has)", r"\bfor best results")),
    ("Replacement part or unit", _rx(
        r"\b(?:send|ship|post|organi[sz]e|order|get) (?:you |out )?(?:a |the |another |some )?(?:new|replacement|spare)",
        r"\breplacement (?:part|unit|chiller|heater|panel|door|glass|controller|pump|board|element|sensor|remote|cover|lid|filter)",
        r"\bswap (?:it|that|the \w+) (?:out|over)", r"\b(?:new|another) (?:one|unit) (?:sent|out|to you)", r"\breplace (?:it|that|the)")),
    ("Technician or electrician", _rx(
        r"\btechnician", r"\b(?:a |the |our )tech\b", r"\bservice (?:agent|tech|call|visit)", r"\bsend (?:someone|somebody) (?:out|round|to)",
        r"\bbook (?:a|in a|you in with a) (?:tech|technician|service|electrician)", r"\bget (?:an|your|the) electrician")),
    ("Asked for photos or video", _rx(
        r"\b(?:send|email|text|sms) (?:us |me |through |over )?(?:a |some |the )?(?:photo|photos|picture|pictures|pic|pics|video|videos|image)",
        r"\btake (?:a |some )?(?:photo|photos|video|picture|pictures)", r"\bphotos? (?:and|or) (?:a )?video")),
    ("Warranty claim raised", _rx(
        r"\bwarranty claim", r"\blodge (?:a|the) (?:claim|warranty)", r"\bunder warranty", r"\bcovered (?:under|by) (?:the |your )?warranty",
        r"\bclaim form", r"\braise (?:a|the) (?:claim|ticket|case)")),
    ("Delivery rebooked or chased", _rx(
        r"\b(?:rebook|reschedule|book in|book the|lock in) (?:the |your |a )?delivery", r"\bchase (?:up )?(?:the )?(?:courier|delivery|freight|carrier|driver|winnings)",
        r"\btracking (?:number|link|details)", r"\b(?:contact|call|speak to|email) (?:the )?(?:courier|carrier|freight company|winnings|driver)",
        r"\bdelivery (?:date|window|slot|time) (?:is|will be|for)", r"\bthe driver will")),
    ("Refund, credit or return", _rx(
        r"\brefund", r"\bcredit (?:note|back|to your)", r"\breturn (?:it|the|that)", r"\bpick (?:it|that) up\b", r"\bpartial refund",
        r"\bcompensat", r"\bgoodwill", r"\bdiscount (?:off|on) your")),
    ("Info or instructions sent", _rx(
        r"\b(?:i'?ll|we'?ll|i will|i can|let me|i'?m going to|gonna) (?:email|send|flick|shoot) (?:you |that |it |through |over |them )",
        r"\b(?:send|email) (?:you )?(?:the |a )?(?:manual|link|instructions|guide|pdf|video|diagram|wiring diagram|documentation)")),
    ("Callback or follow-up promised", _rx(
        r"\bcall you back", r"\bgive you a (?:call|ring|buzz)", r"\bget back to you", r"\btouch base",
        r"\b(?:i|we)(?:'ll| will| can| am going to|'m going to|'m gonna) follow (?:up|that up|it up|this up)",
        r"\bkeep you (?:posted|updated|in the loop)", r"\blet you know (?:as soon|once|when)")),
    ("Passed to a colleague", _rx(
        r"\bpass (?:it|that|this|your \w+) (?:on|through|over)", r"\b(?:speak|talk|chat) (?:to|with) (?:my|the|our) (?:manager|team leader|supervisor|warranty team|technical team|tech team|accounts|service team)",
        r"\bget (?:him|her|them|someone|somebody|matt|matthew|gemma|alice|ricky|reece) to (?:call|ring|contact|reach out|email|get back)",
        r"\bescalat", r"\b(?:he|she)(?:'ll| will) (?:call|get back|reach out|be in touch|give you)", r"\btransfer you", r"\b(?:my|our) colleague",
        r"\b(?:give us a|call us|ring us) (?:buzz |call |ring )?back (?:tomorrow|on monday|later|in the morning)",
        r"\b(?:service|customer service|warranty|tech(?:nical)?|accounts|admin) team (?:will|they'?ll|can|should) (?:be able to )?(?:help|call|contact|sort|get back|reach out)",
        r"\bget (?:one of the team|someone from the team|the team) to (?:call|ring|contact|reach out)")),
]
SOLUTION_LABELS = [label for label, _ in SOLUTIONS]


def solutions(rep_text):
    return [label for label, rxs in SOLUTIONS if hits(rxs, rep_text)]


# --- How the call ended -----------------------------------------------------------
# R fixed or answered on the call, F next step booked, H handed to someone else, U no clear resolution.

OUTCOMES = {
    "R": "Fixed or answered on the call",
    "F": "Next step booked",
    "H": "Handed to someone else",
    "U": "No clear resolution",
}

_CONFIRMED = _rx(
    r"\b(?:it'?s|that'?s|it is|that is|they'?re) (?:all )?(?:working|fixed|sorted|going|heating|cooling|on)(?: now| again)?\b",
    r"\bthat (?:worked|did it|fixed it|did the trick|helps|helped|answers)", r"\b(?:makes|made) (?:sense|perfect sense)",
    r"\bgot it\b", r"\bunderstood\b", r"\ball sorted", r"\bsorted\b", r"\ball good\b", r"\bperfect\b", r"\btoo easy\b",
    r"\bthat'?s (?:great|awesome|brilliant|fantastic|excellent|perfect|beautiful|good to know|all i needed|what i needed)",
    r"\bi'?ll (?:try|give) (?:that|it)(?: a go)?\b", r"\bgreat,? thank", r"\bawesome\b", r"\blegend\b", r"\bunreal\b")
_COMMIT = _rx(
    r"\b(?:i|we)(?:'ll| will| can| am going to|'m going to| are going to|'re going to| gonna) (?:\w+ )?(?:send|organi[sz]e|book|arrange|order|ship|post|chase|lodge|raise|process|refund|credit|replace|swap|get (?:a|the|that|you|someone|one))",
    r"\b(?:i|we)(?:'ll| will| can) (?:email|call|ring|give you a call|follow|get back|look into|find out|check with|confirm|update you|let you know)",
    r"\b(?:technician|tech|electrician|driver|courier|someone|somebody) will (?:call|contact|be in touch|come|reach out|attend)",
    r"\bget back to you", r"\bkeep you (?:posted|updated)", r"\b(?:flick|shoot|drop|fire|pop) (?:you )?(?:an |a |through an |through a )?(?:email|text|message|sms)",
    r"\blook forward to getting (?:this|it|that|everything) sorted", r"\blet me (?:just )?(?:find out|look into|chase (?:that|it|this) up|discuss (?:it|that|this) with)",
    r"\b(?:gonna|going to) (?:go ahead and )?(?:then )?(?:send|email|book|organi[sz]e|arrange|submit|lodge|raise|order)",
    r"\b(?:submitted|raised|lodged|logged|created) (?:a|the|your) (?:ticket|claim|case|request)", r"\bget (?:it|that|you) booked (?:in)?")
_HANDOFF = SOLUTIONS[-1][1]
_STUCK = _rx(
    r"\bstill (?:not|isn'?t|doesn'?t|won'?t|haven'?t|hasn'?t|no|waiting|broken|leaking|tripping|the same)", r"\b(?:not|isn'?t) (?:fixed|resolved|sorted)",
    r"\bnobody (?:has|'s|got|ever|called|rang)", r"\bno one (?:has|'s|got|ever|called|rang)", r"\bnever (?:heard|got|received)",
    r"\b(?:ridiculous|unacceptable|disgrace|joke)\b", r"\bnot happy\b", r"\bwant (?:a|my) (?:refund|money back)",
    r"\b(?:i'?m|we'?re|i am) (?:so |very |really )?(?:frustrated|disappointed|annoyed|upset|over it|fed up)")


def outcome(rep_close, cust_close, closing_mood):
    """Classify how the call ended from its last 40% (rep and customer lines).

    A next step promised by the other side counts too: on calls to couriers,
    installers and technicians the commitment comes from them.
    """
    handed = hits(_HANDOFF, rep_close)
    committed = hits(_COMMIT, rep_close) + hits(_COMMIT, cust_close)
    confirmed = hits(_CONFIRMED, cust_close)
    stuck = hits(_STUCK, cust_close)
    if stuck and closing_mood < 0 and not committed:
        return "U"
    if handed and handed >= committed:
        return "H"
    if committed:
        return "F"
    if confirmed or closing_mood > 0:
        return "R"
    return "U"


# --- Customer mood ---------------------------------------------------------------
# Unhappy customers on these calls are usually polite: they rarely say "frustrated",
# they say "ASAP", "since April", "I can't even use it", "if I don't hear back". So
# frustration counts urgency, history, loss and escalation phrases fully; words
# that only describe a fault count a third. Everyday acknowledgements ("perfect",
# "awesome", "thanks") count a quarter, so a polite goodbye alone isn't "happy".

_FRUSTRATED = _rx(
    r"\bfrustrat", r"\bannoy", r"\bdisappoint", r"\bupset\b", r"\bangry\b", r"\bfurious", r"\bridiculous", r"\bunacceptable",
    r"\bterrible\b", r"\bhorrible\b", r"\bawful\b", r"\buseless\b", r"\bjoke\b", r"\bworst\b", r"\bwaste of\b", r"\bnightmare",
    r"\bstress(?:ed|ful)?\b", r"\bworried\b", r"\bconcerned\b", r"\bnot happy\b", r"\bunhappy\b", r"\bfed up\b", r"\bsick of\b",
    r"\bover it\b", r"\bchasing\b", r"\bstill (?:waiting|not|haven'?t|hasn'?t|no|doesn'?t|isn'?t|won'?t)", r"\bnobody (?:has|'s|got|ever|called|rang)",
    r"\bno one (?:has|'s|got|ever|called|rang)", r"\bnever (?:heard|got|received)", r"\bhaven'?t heard", r"\bpromised\b",
    r"\b(?:weeks|months) (?:now|ago|of)", r"\bfor (?:weeks|months)\b", r"\bsince (?:january|february|march|april|may|june|july|august|september|october|november|december|last (?:week|month))",
    r"\b(?:second|third|fourth|another|multiple|several) (?:time|times|call|email)", r"\bkeeps? (?:happening|tripping|turning off|cutting out|breaking|leaking)",
    r"\basap\b", r"\burgent", r"\blosing (?:clients|customers|money|business)", r"\bcan'?t (?:even )?use (?:it|the|half)", r"\bwouldn'?t have bought",
    r"\bshouldn'?t (?:have to|be paying|need to)", r"\bnot what (?:i|we) (?:paid|ordered|bought)", r"\bnot good enough", r"\bi'?m done\b",
    r"\bif i don'?t hear", r"\bwhen can i expect", r"\bbeen better\b", r"\bcomplain", r"\bdisgrace", r"\brubbish\b", r"\bbloody\b",
    r"\bpissed\b", r"\bshit\b", r"\bcrap\b", r"\bhassle\b", r"\bpaid (?:a lot|so much|good money|over)", r"\bmoney back", r"\brefund\b",
    r"\bcancel", r"\bchargeback", r"\bconsumer affairs|\bfair trading|\baccc\b|\blawyer|\bsolicitor", r"\bfinal demand")
_PROBLEM = _rx(
    r"\bnot working", r"\bstopped working", r"\bdoesn'?t (?:seem to )?work", r"\bbroken\b", r"\bfaulty", r"\bleak", r"\bdamaged?\b", r"\bproblem",
    r"\bissue", r"\berror\b", r"\bwon'?t\b", r"\bcan'?t get", r"\btripping", r"\bmissing\b", r"\bdoesn'?t seem", r"\bhasn'?t (?:seemed|been|come|arrived)")
_POSITIVE = _rx(
    r"\bappreciate (?:it|that|you|your|the|all)", r"\bthank you so much\b", r"\bthanks so much\b", r"\bthank you very much\b",
    r"\b(?:you'?ve|you have) been (?:great|really helpful|amazing|awesome|fantastic|so helpful|very helpful)", r"\breally helpful\b",
    r"\b(?:that'?s|this is) (?:great|awesome|perfect|fantastic|brilliant) news\b", r"\blegend\b", r"\byou'?re a (?:star|champion|gem)",
    r"\b(?:it'?s|that'?s) (?:all )?(?:working|fixed|sorted) now\b", r"\bthat (?:worked|fixed it|did the trick)", r"\bmade my day\b", r"\brelieved\b",
    r"\bhappy with\b", r"\blove (?:it|the)\b", r"\bexcited\b", r"\bmuch better\b", r"\bgreat service\b", r"\bgood service\b")
_ACK = _rx(r"\bperfect\b", r"\bgreat\b", r"\bawesome\b", r"\bbrilliant\b", r"\bexcellent\b", r"\bfantastic\b", r"\blovely\b",
           r"\bbeautiful\b", r"\bsorted\b", r"\btoo easy\b", r"\bsweet\b", r"\bno worries\b", r"\ball good\b", r"\bunreal\b", r"\bglad\b",
           r"\bthank(?:s| you)\b", r"\bcheers\b")


def mood_weights(text):
    neg = hits(_FRUSTRATED, text) + hits(_PROBLEM, text) / 3
    pos = hits(_POSITIVE, text) + hits(_ACK, text) / 4
    return pos, neg


def mood(text):
    """-1 upset, 0 neutral, 1 positive."""
    pos, neg = mood_weights(text)
    if neg >= 1 and neg > pos:
        return -1
    if pos >= 1.25 and pos >= 2 * neg:
        return 1
    return 0
