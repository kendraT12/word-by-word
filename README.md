# Word by Word

Reading and spelling practice for one first grader. Built for a 7-year-old who knows her
letter sounds but spells every word out before she can say it, so the whole app is pointed
at one thing: reading a word **whole** instead of working it out.

## Putting it on an iPad

1. Open the app's link in **Safari** on the iPad.
2. Tap the **Share** button, then **Add to Home Screen**.
3. It gets its own icon and opens full screen, with no Safari bars.

After that it **works with no internet**. Everything she does is saved on that iPad and is
never uploaded anywhere.

## How it works

**She always tries first.** The app never says a word before she has had a go at it.

**No pictures, anywhere.** No images, emoji or colour swatches, in the lessons, the answers
or the rewards — a picture lets a child guess instead of read. Every answer choice is words
she has to read.

**Fast Words** opens each lesson: a word appears with a bar draining over about 3 seconds,
and she says it straight out. There is no time to spell it, which is the point.

**Every new word goes through four steps:** say it, spell it with letter tiles, say what it
means, then read two sentences that use it.

**A word counts as learned only when she reads it whole.** One she sounds out first goes
back into Fast Words tomorrow.

**She moves up when she is ready,** not by the calendar: about 8 in 10 of a step's words
learned, and that step's story read with little help.

### What she learns

Ten steps, from short vowels (`cat`, `sit`) through `sh`/`ch`/`th`, blends, magic e, vowel
teams, `ar`/`or`/`er`, word endings and longer words, up to second-grade stories — 152 words
in all, plus 40 common sight words and 57 everyday words: colours, numbers one to twenty,
days, months and seasons. Each everyday word teaches its meaning too, so `January` is not
just a word she can read but *the first month of the year*. There are 60 built-in stories,
six per step, and every word in every one of them is a word she has already been taught —
no story ever asks her to guess.

### The grown-up corner

Behind a 4-digit code: her streak and minutes, how many words she reads whole versus still
sounds out, which words trip her up, her reading speed over time, a checklist of colours,
days and months, how she did on her first-day check, and one line on what to practise
tonight. There is a button to text yourself a summary — nothing is uploaded.

**Listening is off by default.** A child on her own is never asked for the microphone. A
grown-up can turn it on in the parent corner; then she reads words out loud and the app
checks them. It works best on a computer in Chrome. Either way she can always say the word
and tap to check herself.

## Running it yourself

Any static web server will do:

```bash
python3 -m http.server 8777
```

Then open `http://localhost:8777/`.

## Working on it

| File | What it holds |
|---|---|
| `content.js` | Every word: its meaning, an example sentence, its answer choices |
| `stories.js` | The built-in stories, written to each step's vocabulary |
| `engine.js` | The pure logic: fluency, review scheduling, lesson building, progression |
| `platform.js` | Voice, listening, saving and AI — the only file that touches anything outside |
| `word.js` | The four steps, Fast Words and Slide & Say |
| `lesson.js` | The daily lesson, story time, word collection, first-day check |
| `app.js` | Start-up, her home screen, setup, the grown-up corner |

The logic is covered by tests that run on the JavaScript engine built into macOS, with
nothing to install:

```bash
/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc -m tests/run.js
```

After editing `tools/page.html`, regenerate `index.html`, the manifest and the offline
cache with:

```bash
python3 tools/build-web.py
```

`platform.js` is deliberately the only file that knows about Claude: with it present the app
uses a Claude voice, Claude's dictation and stories written for her on the spot; without it,
the device's own voice, the browser's own speech recognition and the built-in stories. Every
one of those has a fallback, so the app works with none of them.
