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
 * Generate all plausible stems for an English word.
 * Returns multiple candidates to avoid false negatives from
 * ambiguous suffix stripping (e.g. "making" → ["mak", "make"]).
 */
function allStems(word: string): string[] {
  const len = word.length;
  if (len <= 3) return [word];
  const results: string[] = [word];

  const addBase = (base: string) => {
    if (base && !results.includes(base)) results.push(base);
    // Also try with/without doubled consonant reduction and silent 'e'
    if (base.length >= 2 && base[base.length - 1] === base[base.length - 2]) {
      const reduced = base.slice(0, -1);
      if (reduced && !results.includes(reduced)) results.push(reduced);
    }
    if (/[bcdfghjklmnpqrstvwxyz]$/.test(base)) {
      const withE = base + 'e';
      if (!results.includes(withE)) results.push(withE);
    }
  };

  // -ying → -y  (studying → study)
  if (word.endsWith('ying') && len > 5) {
    addBase(word.slice(0, -3));
    return results;
  }

  // -ied → -y  (tried → try)
  if (word.endsWith('ied') && len > 4) {
    const base = word.slice(0, -3) + 'y';
    if (!results.includes(base)) results.push(base);
    return results;
  }

  // -ies → -y  (tries → try)
  if (word.endsWith('ies') && len > 4) {
    const base = word.slice(0, -3) + 'y';
    if (!results.includes(base)) results.push(base);
    return results;
  }

  // -ing
  if (word.endsWith('ing') && len > 4) {
    addBase(word.slice(0, -3));
    return results;
  }

  // -ed
  if (word.endsWith('ed') && len > 3) {
    addBase(word.slice(0, -2));
    // also try removing just -d (e.g. "used" → "use")
    if (word.endsWith('ed') && len > 4) {
      const minusD = word.slice(0, -1);
      if (!results.includes(minusD)) results.push(minusD);
    }
    return results;
  }

  // -er
  if (word.endsWith('er') && len > 4) {
    addBase(word.slice(0, -2));
    // also try removing just -r (e.g. "nicer" → "nice")
    const minusR = word.slice(0, -1);
    if (!results.includes(minusR)) results.push(minusR);
    return results;
  }

  // -est
  if (word.endsWith('est') && len > 5) {
    addBase(word.slice(0, -3));
    return results;
  }

  // -ness
  if (word.endsWith('ness') && len > 5) {
    addBase(word.slice(0, -4));
    return results;
  }

  // -ly
  if (word.endsWith('ly') && len > 4) {
    addBase(word.slice(0, -2));
    return results;
  }

  // -es (watches → watch, boxes → box)
  if (word.endsWith('shes') && len > 5) { addBase(word.slice(0, -2)); return results; }
  if (word.endsWith('ches') && len > 5) { addBase(word.slice(0, -2)); return results; }
  if (word.endsWith('xes') && len > 4) { addBase(word.slice(0, -2)); return results; }
  if (word.endsWith('sses') && len > 5) { addBase(word.slice(0, -2)); return results; }
  if (word.endsWith('zes') && len > 4) { addBase(word.slice(0, -2)); return results; }

  // -s (cats → cat)
  if (word.endsWith('s') && !word.endsWith('ss') && len > 3) {
    const base = word.slice(0, -1);
    if (!results.includes(base)) results.push(base);
    return results;
  }

  return results;
}

/**
 * Get all plausible stems for a word (irregular + suffix-based).
 * Returns lowercase array.
 */
export function stems(word: string): string[] {
  const lower = word.toLowerCase().trim();
  if (!lower) return [lower];

  // Check irregular map first
  const irregular = IRREGULAR_MAP[lower];
  if (irregular) return [lower, irregular];

  return allStems(lower);
}

/**
 * Build a Set of stems from a Set of vocab words.
 * For each vocab word, stores the word itself plus all its stems.
 */
export function buildStemSet(vocabWords: Set<string>): Set<string> {
  const set = new Set<string>();
  for (const w of vocabWords) {
    for (const s of stems(w)) set.add(s);
  }
  return set;
}

/**
 * Check if a word (possibly inflected) matches any collected vocab word.
 * Compares the word's exact form and all its stems against the vocab stem set.
 */
export function isVocabMatch(word: string, vocabWords: Set<string>, vocabStems: Set<string>): boolean {
  const lower = word.toLowerCase();
  if (vocabWords.has(lower)) return true;
  // Check all stems of this word against the vocab stem set
  for (const s of stems(lower)) {
    if (vocabStems.has(s)) return true;
  }
  return false;
}
