/**
 * Lightweight English stemmer for vocab highlighting.
 * Reduces common inflected forms to a rough stem so that
 * "running" matches "run", "goes" matches "go", etc.
 *
 * Not a full Porter stemmer — just handles the most common
 * English inflections that matter for reading comprehension.
 */

const IRREGULAR_MAP: Record<string, string> = {
  // be
  am: 'be', is: 'be', are: 'be', was: 'be', were: 'be', been: 'be', being: 'be',
  // have
  has: 'have', had: 'have', having: 'have',
  // do
  does: 'do', did: 'do', doing: 'do', done: 'do',
  // go
  goes: 'go', went: 'go', gone: 'go', going: 'go',
  // say
  says: 'say', said: 'say', saying: 'say',
  // get
  gets: 'get', got: 'get', gotten: 'get', getting: 'get',
  // make
  makes: 'make', made: 'make', making: 'make',
  // know
  knows: 'know', knew: 'know', known: 'know', knowing: 'know',
  // think
  thinks: 'think', thought: 'think', thinking: 'think',
  // take
  takes: 'take', took: 'take', taken: 'take', taking: 'take',
  // see
  sees: 'see', saw: 'see', seen: 'see', seeing: 'see',
  // come
  comes: 'come', came: 'come', coming: 'come',
  // give
  gives: 'give', gave: 'give', given: 'give', giving: 'give',
  // find
  finds: 'find', found: 'find', finding: 'find',
  // tell
  tells: 'tell', told: 'tell', telling: 'tell',
  // become
  becomes: 'become', became: 'become', becoming: 'become',
  // leave
  leaves: 'leave', left: 'leave', leaving: 'leave',
  // feel
  feels: 'feel', felt: 'feel', feeling: 'feel',
  // put
  puts: 'put', putting: 'put',
  // bring
  brings: 'bring', brought: 'bring', bringing: 'bring',
  // begin
  begins: 'begin', began: 'begin', begun: 'begin', beginning: 'begin',
  // keep
  keeps: 'keep', kept: 'keep', keeping: 'keep',
  // hold
  holds: 'hold', held: 'hold', holding: 'hold',
  // write
  writes: 'write', wrote: 'write', written: 'write', writing: 'write',
  // stand
  stands: 'stand', stood: 'stand', standing: 'stand',
  // hear
  hears: 'hear', heard: 'hear', hearing: 'hear',
  // let
  lets: 'let', letting: 'let',
  // mean
  means: 'mean', meant: 'mean', meaning: 'mean',
  // set
  sets: 'set', setting: 'set',
  // meet
  meets: 'meet', met: 'meet', meeting: 'meet',
  // run
  runs: 'run', ran: 'run', running: 'run',
  // pay
  pays: 'pay', paid: 'pay', paying: 'pay',
  // sit
  sits: 'sit', sat: 'sit', sitting: 'sit',
  // speak
  speaks: 'speak', spoke: 'speak', spoken: 'speak', speaking: 'speak',
  // lie
  lies: 'lie', lay: 'lie', lain: 'lie', lying: 'lie',
  // lead
  leads: 'lead', led: 'lead', leading: 'lead',
  // read
  reads: 'read', reading: 'read',
  // grow
  grows: 'grow', grew: 'grow', grown: 'grow', growing: 'grow',
  // lose
  loses: 'lose', lost: 'lose', losing: 'lose',
  // fall
  falls: 'fall', fell: 'fall', fallen: 'fall', falling: 'fall',
  // send
  sends: 'send', sent: 'send', sending: 'send',
  // build
  builds: 'build', built: 'build', building: 'build',
  // understand
  understands: 'understand', understood: 'understand', understanding: 'understand',
  // draw
  draws: 'draw', drew: 'draw', drawn: 'draw', drawing: 'draw',
  // break
  breaks: 'break', broke: 'break', broken: 'break', breaking: 'break',
  // spend
  spends: 'spend', spent: 'spend', spending: 'spend',
  // cut
  cuts: 'cut', cutting: 'cut',
  // rise
  rises: 'rise', rose: 'rise', risen: 'rise', rising: 'rise',
  // drive
  drives: 'drive', drove: 'drive', driven: 'drive', driving: 'drive',
  // buy
  buys: 'buy', bought: 'buy', buying: 'buy',
  // wear
  wears: 'wear', wore: 'wear', worn: 'wear', wearing: 'wear',
  // choose
  chooses: 'choose', chose: 'choose', chosen: 'choose', choosing: 'choose',
  // seek
  seeks: 'seek', sought: 'seek', seeking: 'seek',
  // throw
  throws: 'throw', threw: 'throw', thrown: 'throw', throwing: 'throw',
  // catch
  catches: 'catch', caught: 'catch', catching: 'catch',
  // deal
  deals: 'deal', dealt: 'deal', dealing: 'deal',
  // win
  wins: 'win', won: 'win', winning: 'win',
  // fight
  fights: 'fight', fought: 'fight', fighting: 'fight',
  // teach
  teaches: 'teach', taught: 'teach', teaching: 'teach',
  // eat
  eats: 'eat', ate: 'eat', eaten: 'eat', eating: 'eat',
  // drink
  drinks: 'drink', drank: 'drink', drunk: 'drink', drinking: 'drink',
  // sing
  sings: 'sing', sang: 'sing', sung: 'sing', singing: 'sing',
  // swim
  swims: 'swim', swam: 'swim', swum: 'swim', swimming: 'swim',
  // fly
  flies: 'fly', flew: 'fly', flown: 'fly', flying: 'fly',
  // forget
  forgets: 'forget', forgot: 'forget', forgotten: 'forget', forgetting: 'forget',
  // hide
  hides: 'hide', hid: 'hide', hidden: 'hide', hiding: 'hide',
  // wake
  wakes: 'wake', woke: 'wake', woken: 'wake', waking: 'wake',
  // sell
  sells: 'sell', sold: 'sell', selling: 'sell',
  // show
  shows: 'show', showed: 'show', shown: 'show', showing: 'show',
  // sleep
  sleeps: 'sleep', slept: 'sleep', sleeping: 'sleep',
  // children: 'child',
  children: 'child',
  // men/women
  men: 'man', women: 'woman',
  // people
  people: 'person',
  // teeth/feet/mice
  teeth: 'tooth', feet: 'foot', mice: 'mouse',
  // better/best
  better: 'good', best: 'good',
  // worse/worst
  worse: 'bad', worst: 'bad',
  // more/most (from much/many)
  // less/least
};

/**
 * Simple suffix-based stem for regular English words.
 * Strips common endings to produce a rough root form.
 */
function stripSuffix(word: string): string {
  const len = word.length;
  if (len <= 3) return word;

  // -ying → -y  (e.g. studying → study) — but not "lying" which is irregular
  if (word.endsWith('ying') && len > 5) return word.slice(0, -3);

  // -ied → -y  (e.g. tried → try, carried → carry)
  if (word.endsWith('ied') && len > 4) return word.slice(0, -3) + 'y';

  // -ies → -y  (e.g. tries → try, carries → carry) but not 2-letter root
  if (word.endsWith('ies') && len > 4) return word.slice(0, -3) + 'y';

  // -ing: doubled consonant (running → run, sitting → sit)
  if (word.endsWith('ing') && len > 5) {
    const base = word.slice(0, -3);
    // Doubled consonant before -ing
    if (base.length >= 2 && base[base.length - 1] === base[base.length - 2]) {
      return base.slice(0, -1);
    }
    // e.g. making → mak → make, writing → writ → write
    // If removing -ing leaves a consonant, try adding 'e'
    if (/[bcdfghjklmnpqrstvwxyz]$/.test(base)) {
      return base + 'e';
    }
    return base;
  }
  // Short -ing (e.g. being → be, but that's irregular)
  if (word.endsWith('ing') && len > 4) {
    return word.slice(0, -3);
  }

  // -ed: doubled consonant (stopped → stop)
  if (word.endsWith('ed') && len > 4) {
    const base = word.slice(0, -2);
    if (base.length >= 2 && base[base.length - 1] === base[base.length - 2]) {
      return base.slice(0, -1);
    }
    // e.g. liked → lik → like
    if (/[bcdfghjklmnpqrstvwxyz]$/.test(base) && !/[bcdfghjklmnpqrstvwxyz]{2}$/.test(base)) {
      return base + 'e';
    }
    return base;
  }
  if (word.endsWith('ed') && len > 3) {
    return word.slice(0, -2);
  }

  // -er (comparative or agent: bigger → big, runner → run, player → play)
  if (word.endsWith('er') && len > 4) {
    const base = word.slice(0, -2);
    if (base.length >= 2 && base[base.length - 1] === base[base.length - 2]) {
      return base.slice(0, -1);
    }
    return base;
  }

  // -est (superlative: biggest → big)
  if (word.endsWith('est') && len > 5) {
    const base = word.slice(0, -3);
    if (base.length >= 2 && base[base.length - 1] === base[base.length - 2]) {
      return base.slice(0, -1);
    }
    return base;
  }

  // -ness (happiness → happi, sadness → sad)
  if (word.endsWith('ness') && len > 5) return word.slice(0, -4);

  // -ly (quickly → quick, happily → happi)
  if (word.endsWith('ly') && len > 4) return word.slice(0, -2);

  // -es (watches → watch, boxes → box, goes → go)
  if (word.endsWith('shes') && len > 5) return word.slice(0, -2);
  if (word.endsWith('ches') && len > 5) return word.slice(0, -2);
  if (word.endsWith('xes') && len > 4) return word.slice(0, -2);
  if (word.endsWith('sses') && len > 5) return word.slice(0, -2);
  if (word.endsWith('zes') && len > 4) return word.slice(0, -2);

  // -s (cats → cat, plays → play)
  if (word.endsWith('s') && !word.endsWith('ss') && len > 3) return word.slice(0, -1);

  return word;
}

/**
 * Reduce an English word to a stem for comparison.
 * First checks irregular forms, then applies suffix stripping.
 * Returns lowercase.
 */
export function stem(word: string): string {
  const lower = word.toLowerCase().trim();
  if (!lower) return lower;

  // Check irregular map first
  const irregular = IRREGULAR_MAP[lower];
  if (irregular) return irregular;

  return stripSuffix(lower);
}

/**
 * Build a Set of stems from a Set of vocab words.
 * Maps each vocab word to its stem, so we can match text variants.
 */
export function buildStemSet(vocabWords: Set<string>): Set<string> {
  const stems = new Set<string>();
  for (const w of vocabWords) {
    stems.add(w); // keep original
    stems.add(stem(w)); // add stem
  }
  return stems;
}

/**
 * Check if a word (possibly inflected) matches any collected vocab word.
 * Compares both the exact lowercase form and the stemmed form.
 */
export function isVocabMatch(word: string, vocabWords: Set<string>, vocabStems: Set<string>): boolean {
  const lower = word.toLowerCase();
  if (vocabWords.has(lower)) return true;
  return vocabStems.has(stem(lower));
}
