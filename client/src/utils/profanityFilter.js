/**
 * Profanity Filter Utility
 * Word list sourced from detect-profanity (npm) — https://github.com/s21sd/Profanity
 * Extended with a comprehensive Hinglish (Roman-script Hindi) bad-word list.
 *
 * Exported API:
 *   isBadWord(word)        → true if a single word is profane
 *   containsBadWords(text) → true if any word/phrase in the text is profane
 *   getProfaneWords(text)  → array of matched bad words/phrases found in text
 *
 * Detection strategy:
 *   1. Token-level set lookup  — fast O(1) per token, catches single words.
 *   2. Phrase-level substring   — catches multi-word Hinglish phrases like
 *      "maa ki aankh", "behen ke lode", etc.
 */

const BAD_WORDS = new Set([
  "abortion","abuse","adult","alligatorbait","amateur","anal","analannie","analsex","angie","anus",
  "arab","arabs","areola","argie","aroused","arse","arsehole","asian","ass","assassin","assassinate",
  "assassination","assault","assbagger","assblaster","assclown","asscowboy","asses","assfuck",
  "assfucker","asshat","asshole","assholes","asshore","assjockey","asskiss","asskisser","assklown",
  "asslick","asslicker","asslover","assman","assmonkey","assmunch","assmuncher","asspacker",
  "asspirate","asspuppies","assranger","asswhore","asswipe","athletesfoot","attack","australian",
  "babe","babies","backdoor","backdoorman","backseat","badfuck","balllicker","balls","ballsack",
  "banging","baptist","barelylegal","barf","barface","barfface","bast","bastard","bazongas","bazooms",
  "beaner","beast","beastality","beastial","beastiality","beatoff","beat-off","beatyourmeat",
  "beaver","bestial","bestiality","bi","biatch","bible","bicurious","bigass","bigbastard","bigbutt",
  "bigger","bisexual","bi-sexual","bitch","bitcher","bitches","bitchez","bitchin","bitching",
  "bitchslap","bitchy","biteme","black","blackman","blackout","blacks","blind","blow","blowjob",
  "boang","bogan","bohunk","bollick","bollock","bomb","bombers","bombing","bombs","bomd","bondage",
  "boner","bong","boob","boobies","boobs","booby","boody","boom","boong","boonga","boonie","booty",
  "bootycall","bountybar","bra","brea5t","breast","breastjob","breastlover","breastman","brothel",
  "bugger","buggered","buggery","bullcrap","bulldike","bulldyke","bullshit","bumblefuck","bumfuck",
  "bunga","bunghole","buried","burn","butchbabes","butchdike","butchdyke","butt","buttbang",
  "butt-bang","buttface","buttfuck","butt-fuck","buttfucker","butt-fucker","buttfuckers",
  "butt-fuckers","butthead","buttman","buttmunch","buttmuncher","buttpirate","buttplug","buttstain",
  "byatch","cacker","cameljockey","cameltoe","canadian","cancer","carpetmuncher","carruth","catholic",
  "catholics","cemetery","chav","cherrypopper","chickslick","childrens","chin","chinaman","chinamen",
  "chinese","chink","chinky","choad","chode","christ","christian","church","cigarette","cigs",
  "clamdigger","clamdiver","clit","clitoris","clogwog","cocaine","cock","cockblock","cockblocker",
  "cockcowboy","cockfight","cockhead","cockknob","cocklicker","cocklover","cocknob","cockqueen",
  "cockrider","cocksman","cocksmith","cocksmoker","cocksucer","cocksuck","cocksucked","cocksucker",
  "cocksucking","cocktail","cocktease","cocky","cohee","coitus","color","colored","coloured","commie",
  "communist","condom","conservative","conspiracy","coolie","cooly","coon","coondog","copulate",
  "cornhole","corruption","cra5h","crabs","crack","crackpipe","crackwhore","crack-whore","crap",
  "crapola","crapper","crappy","crash","creamy","crime","crimes","criminal","criminals","crotch",
  "crotchjockey","crotchmonkey","crotchrot","cum","cumbubble","cumfest","cumjockey","cumm","cummer",
  "cumming","cumquat","cumqueen","cumshot","cunilingus","cunillingus","cunn","cunnilingus","cunntt",
  "cunt","cunteyed","cuntfuck","cuntfucker","cuntlick","cuntlicker","cuntlicking","cuntsucker",
  "cybersex","cyberslimer","dago","dahmer","dammit","damn","damnation","damnit","darkie","darky",
  "datnigga","dead","deapthroat","death","deepthroat","defecate","dego","demon","deposit","desire",
  "destroy","deth","devil","devilworshipper","dick","dickbrain","dickforbrains","dickhead","dickless",
  "dicklick","dicklicker","dickman","dickwad","dickweed","diddle","die","died","dies","dike","dildo",
  "dingleberry","dink","dipshit","dipstick","dirty","disease","diseases","disturbed","dive","dix",
  "dixiedike","dixiedyke","doggiestyle","doggystyle","dong","doodoo","doo-doo","doom","dope",
  "dragqueen","dragqween","dripdick","drug","drunk","drunken","dumb","dumbass","dumbfuck","dumbshit",
  "dumshit","dyke","easyslut","eatme","ejaculate","erect","erection","erotic","erotica","escort",
  "estupido","evildick","execution","executions","executor","exhibitionist","extacy","extremist",
  "faggit","faggot","faggs","fagot","fagots","fags","fartknocker","fatass","fcuk","feces","felatio",
  "fellate","fellatio","feltch","feltcher","femidom","fetish","figging","finger","fingerbang",
  "fingerfuck","fingerfucked","fingerfucker","fingerfuckers","fingerfucking","fingerfucks","fist",
  "fisted","fistfuck","fistfucked","fistfucker","fistfucking","fistfuckings","fistfucks","flange",
  "flasher","flatbread","fleshflute","floo","fook","foreskin","foursome","freak","freaks","fudge",
  "fudgepacker","fuk","fuker","fukker","fukkin","fuks","fukwhit","fukwit","fullofshit","fuq","furburger",
  "fuk","fuck","fucka","fuckass","fuckbag","fuckboy","fuckbuddy","fucked","fuckedup","fucker",
  "fuckers","fuckface","fuckfest","fuckfreak","fuckhead","fuckhole","fuckin","fucking","fuckings",
  "fuckme","fuckoff","fuckpig","fucks","fucktard","fuckup","fuckwad","fuckwhit","fuckwit","fudgepacker",
  "gangbang","ganja","gayass","gaybob","gaydo","gaylord","gaytard","gaywad","gender","genitals",
  "gimp","glans","godamn","goddamn","goddamned","goddamnit","goddammit","gonads","gonorrhea",
  "gringo","grope","gspot","guido","hacker","hardcore","hardon","harlot","headfuck","hell",
  "heroin","herpes","heshe","hetero","hitler","hobo","hoe","hoer","homo","honkey","hooker","horn",
  "horney","horny","horseshit","hump","humping","hymen","idiot","incest","injun","jackass","jackoff",
  "jack-off","jagoff","jailbait","japs","jerk","jerkoff","jizm","jizz","jizzum","juggs","jungle",
  "junkie","kinky","knob","knobead","knobed","knobend","knobhead","knobjocky","knobjokey","kock",
  "kondum","kondums","kooch","kooches","kootch","kraut","kum","kummer","kumming","kums","kunilingus",
  "kwif","labia","lameass","lesb","lesbian","lesbo","lesbos","lesdom","lessy","lezbe","lezbian",
  "lezbians","lezbo","lezbos","lezzie","lezzies","lezzy","lmfao","lmao","loin","loins","lolita",
  "lubejob","lust","lustful","mafia","mams","masochism","masochist","massage","masterbate",
  "masterbating","masterbation","masturbate","masturbating","masturbation","menage","menstrual",
  "meth","milf","minge","misogynist","mojo","molest","molestation","molester","moolie","moron",
  "moslem","mothafuck","mothafucka","mothafuckas","mothafuckaz","mothafucked","mothafucker",
  "mothafuckers","mothafuckin","mothafucking","mothafuckings","mothafucks","motherfuck",
  "motherfucka","motherfucked","motherfucker","motherfuckers","motherfuckin","motherfucking",
  "motherfuckings","motherfucks","muff","muffdive","muffdiver","muffpuff","mutha","muthafecker",
  "muthafuck","muthafuckker","muther","mutherfucker","naked","napalm","nappy","nazi","necro",
  "negro","nig","nigga","niggah","niggas","niggaz","nigger","niggers","niggle","niggles","nimrod",
  "nipple","nob","nobhead","nobjocky","nobjokey","nonce","nude","nudist","nudity","numbnuts","nut",
  "nutsack","nymph","nympho","nymphomania","oneliner","oral","orgy","ovary","paki","pantie","panties",
  "panty","pecker","pedophile","pedo","peedo","penis","penisbanger","penisfucker","penispuffer",
  "piss","pissed","pisser","pissers","pisses","pissflaps","pissin","pissing","pissoff","poop",
  "porn","porno","pornography","prick","prig","pube","pubic","punk","puss","pussy","pussylicker",
  "pussypounder","queef","queer","rape","raped","raper","rapist","raping","rectum","remains",
  "rentafuck","republican","rere","retard","retarded","ribbed","rigger","rimjob","rimming","roach",
  "robber","roundeye","rump","russki","russkie","sadis","sadom","samckdaddy","sandm","sandnigger",
  "satan","scag","scallywag","scat","schlong","screw","screwyou","scrotum","scum","semen","seppo",
  "servant","sex","sexed","sexfarm","sexhound","sexhouse","sexing","sexkitten","sexpot","sexslave",
  "sextogo","sextoy","sextoys","sexual","sexually","sexwhore","sexy","sexymoma","sexy-slim","shag",
  "shaggin","shagging","shat","shav","shawtypimp","sheeney","shhit","shinola","shit","shitcan",
  "shitdick","shite","shiteater","shited","shitface","shitfaced","shitfit","shitforbrains","shitfuck",
  "shitfucker","shitfull","shithapens","shithappens","shithead","shithouse","shiting","shitlist",
  "shitola","shitoutofluck","shits","shitstain","shitted","shitter","shitting","shitty","shoot",
  "shooting","shortfuck","showtime","sick","sissy","sixsixsix","sixtynine","sixtyniner","skank",
  "skankbitch","skankfuck","skankwhore","skanky","skankybitch","skankywhore","skinflute","skum",
  "skumbag","slant","slanteye","slapper","slaughter","slav","slave","slavedriver","sleezebag",
  "sleezeball","slideitin","slime","slimeball","slimebucket","slopehead","slopey","slopy","slut",
  "sluts","slutt","slutting","slutty","slutwear","slutwhore","smack","smackthemonkey","smut","snatch",
  "snatchpatch","snigger","sniggered","sniggering","sniggers","sniggersown","sniper","snot","snowback",
  "snownigger","sob","sodom","sodomise","sodomite","sodomize","sodomy","sonofabitch","sonofbitch",
  "sooty","sos","soviet","spaghettibender","spaghettinigger","spank","spankthemonkey","sperm",
  "spermacide","spermbag","spermhearder","spermherder","spic","spick","spig","spigotty","spik",
  "spit","spitter","splittail","spooge","spreadeagle","spunk","spunky","squaw","stagg","stiffy",
  "strapon","stringer","stripclub","stroke","stroking","stupid","stupidfuck","stupidfucker","suck",
  "suckdick","sucker","suckme","suckmyass","suckmydick","suckmytit","suckoff","swallow","swallower",
  "swalow","syphilis","taboo","taff","tampon","tang","tarbaby","tard","teat","terror","terrorist",
  "testicle","testicles","thicklips","thirdeye","thirdleg","threesome","threeway","timbernigger",
  "tinkle","tit","titbitnipply","titfuck","titfucker","titfuckin","titjob","titlicker","titlover",
  "tits","tittie","titties","titty","tnt","toilet","tongethruster","tongue","tonguethrust",
  "tonguetramp","tortur","torture","tosser","towelhead","trailertrash","tramp","trannie","tranny",
  "transexual","transsexual","transvestite","triplex","trisexual","trojan","trots","tuckahoe",
  "tunneloflove","turd","turnon","twat","twink","twinkie","twobitwhore","uck","unfuckable","upskirt",
  "uptheass","upthebutt","urinary","urinate","urine","usama","uterus","vagina","vaginal","vatican",
  "vibr","vibrater","vibrator","vietcong","violence","virgin","virginbreaker","vomit","vulva","wab",
  "wank","wanker","wanking","waysted","weapon","weenie","weewee","welcher","welfare","wetb","wetback",
  "wetspot","whacker","whash","whigger","whiskey","whiskeydick","whiskydick","whit","whitenigger",
  "whites","whitetrash","whitey","whiz","whop","whore","whorefucker","whorehouse","wigger","willie",
  "williewanker","willy","wog","wop","wtf","wuss","wuzzie","yankee","yellowman","zigabo","zipperhead",
  // ─── Hindi / Hinglish — single-word tokens ───────────────────────────────
  // Core anatomical & sexual slurs
  "chut","choot","choot","chutiya","chutia","chutiye","chutiyon","chutiyas",
  "chodu","choda","chodi","chode","chodna","chodne","chodega","chodegi","chodoge",
  "chodta","chodti","chodke","chodkar","chodwa","chudai","chudaai","chudana",
  "chudwana","chudwao","chudwaya","chudwai","chudan",
  "gaand","gand","gaandu","gandu","gaandmara","gandmara","gaandufaad",
  "gaandphatna","gaand-faadu","gandoo","gaandoo",
  "lund","loda","lode","laudey","lauda","lawda","lawde","lavda","lavde","lavdey",
  "lund-faadu","lundbaaz","lundbaazi","lundoor","lundbaz",
  "bhosda","bhosdike","bhosdiwala","bhosdiwale","bhosdike","bhosdi","bhosad",
  "bhosda","bhosdike","bhosdiwaala","bhosadike",
  "maa ki","maa ke","maaki","maake",
  "behen ki","behen ke","behenki","behenke","behan ki","behan ke","behanki","behanke",
  "randi","raandi","randa","runde","rundi","randa","runde","besharam",
  "harami","haraami","haraamzada","haraamzaadi","haramzada","haramzadi",
  "haraamkhor","haramkhor",
  "kamina","kameena","kameeni","kamini","kamini",
  "sali","saali","sala","saala","saale","saali",
  "kutiya","kuttiya","kutti","kutri","kuttee","kutte","kuttey","kutta","kutton",
  "suar","suwar","sowar","soover","suver","suarki","suerki",
  "tatti","tattu","tattoo",
  "jhant","jhaat","jhaant","jhaatu","jhantoo","jhaantoo","jhantay","jhaatay",
  "muth","muthna","mutthna","muthmar","muttmar","muthmaaro",
  "pucchi","puchi","puchhi",
  "dhaila","dhaili",
  "ghanta","ghante","ghantaa",
  "phudi","phuddi","phud",
  "nikka","nikke",
  "paaji","paji","paa ji",
  "nalayak","nalaayak","nalayak",
  "ullu","ulloo","ulluk","ulluke","ullukey",
  "gadha","gaadha","gadhe","gadhi","gaadhi",
  "bakwaas","bakwas","bakwaasi",
  "hijra","hijda","hijde","hijdey","kinnar",
  "napunsak","napunsak","napunsank",
  "chinal","chinaal","chinal",
  "besharmi","besharam","nirlajj",
  "gashti","gashtin","ghashti","gasti",
  "tawaif","tawayaf","tawaiyaf",
  "veshya","vesya","veshyaa",
  "dalli","daali",
  "randwa","randhwa","randuve",
  "chakka","chakke","chakkay",
  "bhand","bhanda","bhande","bhandey",
  "patakha","patakhi","patakh",
  "joru","joru",
  "luchcha","lucha","luchhe","luche",
  "gira","giri","gire",
  "badmaash","badmash","badmaashi","badmaash",
  "lafanga","lafange","lafangey",
  "awara","aawara",
  "bawasir","piles",
  "chirkut","chirkutt","chirkute",
  "maderchod","madarchod","madarchodu","madarchood","madarchode","madarchodi",
  "maaderchod","maadarychod","maadarchodh",
  "behenchod","behanchod","behenchoda","behanchoda","behenchodi","behanchodi",
  "bhenchod","bhen chod","bhainchod","bhaanchod","bhaanchodi",
  "bahenchod","bahanchod",
  "bhaand","bhaande",
  "bhosdike","bhosdike",
  "teri maa","teri behen","teri behan","teri maa ki","teri behen ki",
  "apni maa","apni behen","apni behan",
  "madar","madarchodh",

  // Leet / phonetic variants
  "ch00t","ch00tiya","ch0du","l0da","l0de","g4and","g@and","@ss","@sshole",
  "ch$t","b#hn ch0d","bh3nchod","m@darchod","bh0sdi",

  // Common Hinglish abuses with filler patterns
  "abe saale","abe sala","abe yaar","oye kutte","oye sali","oye saale",
  "teri","teri maa ki ankh","teri maa ki aankh",
  "bakri","bakra","tharki","tharkee","tharkipan",
  "pagal","paagal","pagli","paagali",
  "kamine","kaminey","kaminay",
  "dalaal","dalaali","dalal",
  "sada hua","sade hue","gandi","ganda","gande",
  "chikna","chikni","chikne",
  "chhinal","chhinal","chinal",
  "randi rona","randi roya",
  "ghusao","ghusao",
  "chhod","chhoda","chhodi","chhode",
  "chodh","chodhna","chodha",
  "nangaa","nanga","nangi","naangi",
  "ninety-nine",
  "lauda lashkara","lauda lashkar",
  "phek","phekna","pheku","pheeku",
  "chapri","chapriya","chapre","chaprey",
  "bhikari","bhikhari","bheekhari",
  "makaar","makkar","makkaar",
  "dhokhebaaz","dhokebaaz","dhokebaz","dhoka","dhokha",
  "patli gali se","patli gali",
]);

// ─── Hinglish multi-word phrases (substring matched) ─────────────────────────
// These are common 2-4 word Hinglish abuses that need phrase-level matching
// because they span multiple tokens.
const BAD_PHRASES = [
  // maa / mother insults
  "maa ki chut","maa ki aankh","maa ki ankh","maa ki aankhen","maa ki aankhon",
  "maa ka bhosda","maa ka loda","maa ko chod","maa ke lode","maa ko chodna",
  "teri maa ki","teri maa ko","apni maa ko","apni maa ki",
  "teri maa ki chut","teri maa ka","teri maa ke",
  "maa behen ki","maa behan ki",
  // behen / sister insults
  "behen ki chut","behan ki chut","behen ke lode","behan ke lode",
  "behen ko chod","behan ko chod","teri behen ki","teri behan ki",
  "behen chod","behan chod","bhenchod","bhaanchod",
  "teri behen ko","apni behen ki",
  // baap / father
  "baap ko chod","baap ki chut","baap ke lode",
  // gaand
  "gaand mara","gaand maar","apni gaand","teri gaand","gaand me le",
  "gaand me ghus","gaand faad","gaand maro","gaand marao","gaand phatna",
  "gaand ka dhakkan","apni gaand mara","gaand me danda",
  // lund / lauda
  "lund le lo","lund maar","lund choos","lund faad","lauda le","mera lund",
  "tera lund","uska lund","lund ke baal","lund ki khaal","lund choosna",
  "lavde ke baal","lavde ki","lavde ka",
  // chut / vagina
  "chut marike","chut maar","chut ke","chut ka","chut me","chut faad",
  "meri chut","teri chut","uski chut","choot ke","apni chut","choot maarni",
  "choot faad","choot maar",
  // bhosda
  "bhosda teri","bhosda maa","bhosda behen","bhosdike saale","bhosdike kamino",
  // randi
  "randi ki aulad","randi ka bacha","randi ke","randi ki","randi baji",
  "randi rona","tu randi hai","teri maa randi","teri behen randi",
  // haraami / harami
  "haraami ki aulad","harami ki aulad","haramzade ki","haraamzade ki",
  "haraami kamine","haraami kahin ke",
  // kutta / dog insults
  "kutta kahin ka","kutte ki aulad","kuttey ki aulad","kutta sala","kutta saala",
  "kutton ki tarah","kutte ke bachhe","kutte ka pilla",
  // suar / pig insults
  "suar ki aulad","suar ka bacha","suar kahin ka","suwar ki aulad",
  // chakka / hijra
  "chakka kahin ka","hijra kahin ka","hijde ki aulad",
  // general
  "teri naani ki","teri daadi ki","gand faadu","gand mara",
  "chodo saale","chodo kamino","chodo harami",
  "tharki saala","tharki kamine","tharki launda",
  "ullu ke pathe","ullu ka pattha","ullu ka patthu",
  "teri aukaat","teri aukat kya","aukat nahi hai",
  "nikal behen ke","nikal behen ki","nikal yahan se behen",
  "jhant ke baal","jhaat ke baal","jhaant ke baal",
  "maa baap ko","maa baap ki","maa bap ko bech",
  "randi baj","randi baaz","randi baazi",
  "lafange kahin ke","lafanga sala",
  "goli maar","goli maaro","goli maar de",
  "naali ka keeda","naali ki keedi",
  "jaa apni maa ko","jaa behen ke","jaa saale",
  "bhad me jao","bhaad me jao","bhaad mein jao",
  "bhaad me","bhaad mein","bhaad mai",
  "muh me le","muh mein le","mooh me le",
  "phad denge","phad dunga","phad dugi",
  "tod dunga","tod denge","tod dugi",
  "maar dunga","maar denge","maar dugi","maar dalenge",
];

/**
 * Normalize a token — strip edge punctuation and lowercase.
 * @param {string} token
 * @returns {string}
 */
function normalize(token) {
  return token.replace(/^[^a-zA-Z\u0900-\u097F]+|[^a-zA-Z\u0900-\u097F]+$/g, "").toLowerCase();
}

/**
 * Normalize an entire text block for phrase search — collapse whitespace and lowercase.
 * @param {string} text
 * @returns {string}
 */
function normalizeText(text) {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Check if a single word is a bad word.
 * @param {string} word
 * @returns {boolean}
 */
export function isBadWord(word) {
  if (!word) return false;
  return BAD_WORDS.has(word.toLowerCase().trim());
}

/**
 * Check if a text contains any bad words or bad phrases.
 * Uses token-level lookup + phrase-level substring search.
 * @param {string} text
 * @returns {boolean}
 */
export function containsBadWords(text) {
  if (!text) return false;
  // 1. Token check
  const tokens = text.split(/\s+/);
  if (tokens.some((token) => BAD_WORDS.has(normalize(token)))) return true;
  // 2. Phrase check
  const norm = normalizeText(text);
  return BAD_PHRASES.some((phrase) => norm.includes(phrase));
}

/**
 * Returns an array of profane words/phrases found in the text.
 * @param {string} text
 * @returns {string[]}
 */
export function getProfaneWords(text) {
  if (!text) return [];
  const found = new Set();
  // Token matches
  const tokens = text.split(/\s+/);
  tokens.forEach((token) => {
    const n = normalize(token);
    if (n.length > 0 && BAD_WORDS.has(n)) found.add(n);
  });
  // Phrase matches
  const norm = normalizeText(text);
  BAD_PHRASES.forEach((phrase) => {
    if (norm.includes(phrase)) found.add(phrase);
  });
  return Array.from(found);
}
