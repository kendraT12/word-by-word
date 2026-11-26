// Word by Word: lesson material only. No code that depends on a browser or on Claude.
//
// Entry fields
//   w     the word            kind  thing | action | describe | little | everyday
//   mean  short meaning she picks or says        ex   example sentence ({name} = her name)
//   art   "", "The" (things only; default is A/An)
//   pat   which "new sound" intro it belongs to   hi   letters to highlight if not pat ("" = none)
//   end   ending to highlight (cats -> s)         fill/alts  sentence with ___ and two wrong words (little words)

const T = (w, mean, ex, o = {}) => ({ w, kind: "thing", mean, ex, ...o });
const A = (w, mean, ex, o = {}) => ({ w, kind: "action", mean, ex, ...o });
const D = (w, mean, ex, o = {}) => ({ w, kind: "describe", mean, ex, ...o });
const L = (w, fill, alts, ex, o = {}) => ({ w, kind: "little", fill, alts, ex, ...o });
const EV = (w, cat, mean, ex) => ({ w, kind: "everyday", cat, mean, ex, step: 0, pat: null });

function step(id, name, intro, groups) {
  const words = groups.flatMap(([pat, list]) => list.map((e) => ({ cat: null, ...e, step: id, pat })));
  return { id, name, pats: Object.keys(intro), intro, words };
}

const mid = (letter, a, b, c) => `The letter ${letter} makes the sound in the middle of ${a}, ${b}, and ${c}.`;
const team = (letters, tail) => `The letters ${letters} together ${tail}`;
const quietE = (v, a, b, c) =>
  `When a word ends in e, the e is quiet, and it makes the letter ${v} say its name. Listen: ${a}, ${b}, ${c}.`;

export const STEPS = [
  step(1, "Short a and i", {
    a: mid("a", "cat", "hat", "map"),
    i: mid("i", "sit", "pig", "big"),
  }, [
    ["a", [
      T("cat", "a pet that says meow", "The cat had a nap."),
      T("hat", "a thing you wear on your head", "Dad has a big hat."),
      T("map", "a drawing that shows where places are", "The map is in the bag."),
      T("bag", "a thing you carry stuff in", "The bag is big."),
      D("sad", "not happy", "The cat is sad."),
      T("nap", "a short sleep", "I had a nap."),
      T("fan", "a thing that blows air to cool you", "The fan is on."),
      T("jam", "a sweet food made from fruit", "I had jam.", { art: "" }),
    ]],
    ["i", [
      A("sit", "to rest on a chair or on the floor", "Sit with me."),
      T("pig", "a farm animal that says oink", "The pig is big."),
      D("big", "large, not small", "It is a big hat."),
      A("dig", "to make a hole in the dirt", "The pig can dig."),
      A("win", "to come in first in a game", "I can win."),
      A("zip", "to close something with a zipper", "Zip the bag."),
    ]],
  ]),

  step(2, "Short o, u, and e", {
    o: mid("o", "hot", "dog", "mop"),
    u: mid("u", "sun", "bug", "cup"),
    e: mid("e", "bed", "pen", "leg"),
  }, [
    ["o", [
      D("hot", "very warm", "The sun is hot."),
      T("dog", "a pet that barks", "The dog can sit."),
      T("mop", "a tool for washing the floor", "Dad got the mop."),
      T("box", "a thing with sides that you put stuff in", "The cat is in the box."),
      A("hop", "to jump on one foot", "I can hop to the bed."),
    ]],
    ["u", [
      T("sun", "the bright light in the sky in the day", "The sun is up.", { art: "The" }),
      T("bug", "a tiny animal with six legs", "A bug is on the hat."),
      T("cup", "a small thing you drink from", "The cup is big."),
      A("run", "to go fast on your feet", "The dog can run."),
      T("mud", "wet, soft dirt", "The pig is in the mud.", { art: "" }),
      A("hug", "to hold someone close in your arms", "I hug Mom."),
    ]],
    ["e", [
      T("bed", "a soft place where you sleep", "The cat is on the bed."),
      T("pen", "a thing you write with", "Get a pen."),
      D("wet", "covered in water, not dry", "The dog is wet."),
      T("leg", "the part of your body you stand on", "My leg is wet."),
    ]],
  ]),

  step(3, "sh, ch, th, wh, and ck", {
    sh: team("s and h", "make one sound. You hear it in ship, shop, and fish."),
    ch: team("c and h", "make one sound. You hear it in chin, chip, and rich."),
    th: team("t and h", "make one sound. You hear it in thin, bath, and math."),
    wh: team("w and h", "make one sound. You hear it at the start of when and whip."),
    ck: team("c and k", "make one sound at the end of a word, like duck, sock, and kick."),
  }, [
    ["sh", [
      T("ship", "a big boat", "The ship is big."),
      T("shop", "a place where you buy things", "Mom is at the shop."),
      T("fish", "an animal that swims in water", "The fish is in the dish."),
      T("dish", "a plate or bowl for food", "The dish is hot."),
    ]],
    ["ch", [
      T("chin", "the part of your face under your mouth", "Jam is on his chin."),
      T("chip", "a thin, crunchy snack", "I had a chip."),
      D("rich", "having lots of money", "The man is rich."),
    ]],
    ["th", [
      D("thin", "not thick or fat", "The cat is thin."),
      T("bath", "washing your body in a tub of water", "The dog had a bath."),
      T("math", "learning about numbers", "I can do math.", { art: "" }),
    ]],
    ["wh", [
      L("when", "I nap ___ I am sad.", ["with", "wet"], "When is the bath?"),
      A("whip", "to mix something very fast", "Whip it with a fork."),
    ]],
    ["ck", [
      T("duck", "a bird that swims and says quack", "The duck is wet."),
      T("sock", "a soft thing you wear on your foot", "I lost a sock."),
      A("kick", "to hit something with your foot", "Kick the sock."),
    ]],
  ]),

  step(4, "Blends", {
    startblend: "Some words start with two letters that slide together. Say both sounds fast, like in stop, flag, and frog.",
    endblend: "Some words end with two letters that slide together. Say both sounds, like in jump, hand, and fast.",
  }, [
    ["startblend", [
      A("stop", "to not move or go anymore", "Stop the ship.", { hi: "st" }),
      T("step", "one move of your foot when you walk", "Take a big step.", { hi: "st" }),
      T("flag", "a piece of cloth on a pole", "The flag is up.", { hi: "fl" }),
      T("frog", "a small animal that hops and says ribbit", "The frog can hop.", { hi: "fr" }),
      A("clap", "to hit your hands together", "Clap with me.", { hi: "cl" }),
      T("trip", "going to a place far away", "We went on a trip.", { hi: "tr" }),
      T("drum", "a thing you hit to make music", "Dad has a drum.", { hi: "dr" }),
      T("sled", "a thing you ride down a hill of snow", "The sled is fast.", { hi: "sl" }),
      A("swim", "to move in water", "A fish can swim.", { hi: "sw" }),
    ]],
    ["endblend", [
      A("jump", "to push off the ground with your feet", "The frog can jump.", { hi: "mp" }),
      T("hand", "the part of your body at the end of your arm", "My hand is wet.", { hi: "nd" }),
      D("fast", "quick, not slow", "The dog is fast.", { hi: "st" }),
      T("nest", "a home that a bird makes", "The duck is in the nest.", { hi: "st" }),
      T("milk", "a white drink that comes from cows", "I had milk in a cup.", { art: "", hi: "lk" }),
      T("tent", "a cloth house for camping", "We nap in a tent.", { hi: "nt" }),
    ]],
  ]),

  step(5, "Magic e", {
    a_e: quietE("a", "cake", "game", "lake"),
    i_e: quietE("i", "bike", "kite", "ride"),
    o_e: quietE("o", "home", "bone", "nose"),
    u_e: quietE("u", "cute", "tube", "cube"),
  }, [
    ["a_e", [
      T("cake", "a sweet treat you eat at a birthday", "I had cake."),
      T("game", "something fun you play", "We can win the game."),
      T("name", "what people call you", "My name is {name}."),
      T("lake", "a big pool of water with land all around", "We swim in the lake."),
    ]],
    ["i_e", [
      T("bike", "a thing with two wheels that you ride", "I ride my bike."),
      T("kite", "a toy that flies in the wind on a string", "The kite is up."),
      A("ride", "to sit on something as it moves", "I ride the bus."),
      A("hide", "to go where no one can see you", "The cat can hide."),
      A("smile", "to make a happy face", "I smile at Mom."),
    ]],
    ["o_e", [
      T("home", "the place where you live", "I am at home.", { art: "" }),
      T("bone", "a hard part inside your body", "The dog has a bone."),
      T("nose", "the part of your face you smell with", "My nose is wet."),
      T("rope", "a thick, strong string", "Jump the rope."),
    ]],
    ["u_e", [
      D("cute", "sweet and nice to look at", "The pup is cute."),
      T("tube", "a long, round thing with a hole through it", "The tube is thin."),
    ]],
  ]),

  step(6, "Vowel teams", {
    ee: team("e e", "say the sound in see, tree, and feet."),
    ea: team("e a", "can say that same sound, like in eat and read."),
    ai: team("a i", "say the sound in rain, tail, and wait."),
    ay: team("a y", "say the sound at the end of play and day."),
    oa: team("o a", "say the sound in boat and soap."),
    ow: team("o w", "can say the sound at the end of snow, grow, and slow."),
  }, [
    ["ee", [
      A("see", "to look at something with your eyes", "I see a duck."),
      T("tree", "a tall plant with a trunk and leaves", "A nest is in the tree."),
      T("feet", "the parts of your body you stand on", "My feet are wet.", { art: "" }),
      A("sleep", "to rest with your eyes closed", "I sleep in my bed."),
    ]],
    ["ea", [
      A("eat", "to put food in your mouth and chew it", "I eat cake."),
      A("read", "to look at words and know what they say", "I can read this."),
    ]],
    ["ai", [
      T("rain", "water that falls from the sky", "The rain is wet.", { art: "" }),
      T("tail", "the long part at the back of an animal", "The dog has a tail."),
      A("wait", "to stay until something happens", "Wait for me."),
    ]],
    ["ay", [
      A("play", "to have fun with games or toys", "We play a game."),
      T("day", "the time when the sun is up", "It is a hot day."),
    ]],
    ["oa", [
      T("boat", "a thing that floats and carries you on water", "The boat is on the lake."),
      T("soap", "the stuff you wash your hands with", "Get the soap.", { art: "" }),
    ]],
    ["ow", [
      T("snow", "soft, white, cold flakes that fall in winter", "We play in the snow.", { art: "" }),
      A("grow", "to get bigger", "A tree can grow."),
      D("slow", "not fast", "The boat is slow."),
    ]],
  ]),

  step(7, "ar, or, er, ir, and ur", {
    ar: team("a r", "say the sound in car, star, and farm."),
    or: team("o r", "say the sound in fork, corn, and storm."),
    er: team("e r", "say the sound at the end of sister and river."),
    ir: team("i r", "say the sound in bird, girl, and shirt."),
    ur: team("u r", "say the sound in turn and hurt."),
  }, [
    ["ar", [
      T("car", "a thing with four wheels that people drive", "We ride in the car."),
      T("star", "a tiny light in the night sky", "I see a star."),
      T("farm", "a place where animals and food plants grow", "The pig is on the farm."),
      T("park", "a place with grass and swings to play", "We play at the park."),
      D("dark", "with no light", "It is dark in the tent."),
    ]],
    ["or", [
      T("fork", "a tool with points that you eat with", "I eat with a fork."),
      T("corn", "a yellow food that grows on a cob", "I like corn.", { art: "" }),
      T("storm", "bad weather with rain and wind", "The storm is here."),
    ]],
    ["er", [
      T("sister", "a girl who has the same mom or dad as you", "My sister can swim."),
      T("river", "a long line of water that flows across the land", "Fish swim in the river."),
    ]],
    ["ir", [
      T("bird", "an animal with wings and feathers", "The bird is in the tree."),
      T("girl", "a child who will grow up to be a woman", "The girl has a kite."),
      T("shirt", "a thing you wear on the top part of your body", "My shirt is wet."),
    ]],
    ["ur", [
      A("turn", "to move around to face a new way", "Turn and look at me."),
      A("hurt", "to feel pain", "I hurt my leg."),
    ]],
  ]),

  step(8, "Endings and two-part words", {
    s: "Adding s to the end of a word means more than one. One cat, two cats.",
    es: "Some words add e s to mean more than one, like box and boxes, dish and dishes.",
    ed: "Adding e d to the end of a word means it already happened, like jump and jumped.",
    ing: "Adding i n g to the end of a word means it is happening now, like jump and jumping.",
    two: "Some long words are two small words put together. Sun and set make sunset.",
  }, [
    ["s", [
      T("cats", "more than one cat", "The cats nap on the bed.", { art: "", end: "s" }),
      T("dogs", "more than one dog", "The dogs run fast.", { art: "", end: "s" }),
    ]],
    ["es", [
      T("boxes", "more than one box", "The boxes are big.", { art: "", end: "es" }),
      T("dishes", "more than one dish", "The dishes are wet.", { art: "", end: "es" }),
    ]],
    ["ed", [
      D("jumped", "did a jump, before now", "The frog jumped in the lake.", { end: "ed" }),
      D("played", "had fun, before now", "We played a game.", { end: "ed" }),
      D("wanted", "wished to have, before now", "I wanted a snack.", { end: "ed" }),
    ]],
    ["ing", [
      D("jumping", "doing a jump right now", "The dogs are jumping.", { end: "ing" }),
      D("playing", "having fun right now", "We are playing at the park.", { end: "ing" }),
      D("reading", "looking at words right now", "I am reading to my sister.", { end: "ing" }),
    ]],
    ["two", [
      T("sunset", "the time when the sun goes down", "We see the sunset.", { hi: "" }),
      T("bedtime", "the time to go to sleep", "It is bedtime.", { art: "", hi: "" }),
      T("backpack", "a bag you carry on your back", "My backpack is big.", { hi: "" }),
      T("rainbow", "a curve of colors in the sky after rain", "I see a rainbow.", { hi: "" }),
      T("cupcake", "a small cake for one person", "I had a cupcake.", { hi: "" }),
    ]],
  ]),

  step(9, "More vowel sounds", {
    oo: team("o o", "can say the sound in moon and food. In some words they say the sound in book."),
    ou: team("o u", "say the sound in house, loud, and cloud."),
    ow2: team("o w", "can also say the sound in cow and town."),
    oi: team("o i", "say the sound in coin and point."),
    oy: team("o y", "say the sound in boy and toy."),
    igh: team("i g h", "say the sound in night and light."),
    y: "At the end of a word, the letter y can say the sound at the end of sky, or the sound at the end of happy.",
  }, [
    ["oo", [
      T("moon", "the big light in the night sky", "The moon is big.", { art: "The" }),
      T("food", "what people and animals eat", "The food is hot.", { art: "" }),
      T("book", "pages with words that you read", "I read a book."),
    ]],
    ["ou", [
      T("house", "a building where people live", "My house is big."),
      D("loud", "making a lot of noise", "The drum is loud."),
      T("cloud", "a white or gray puff in the sky", "A cloud is in the sky."),
    ]],
    ["ow2", [
      T("cow", "a farm animal that gives milk", "The cow is on the farm.", { hi: "ow" }),
      T("town", "a place with homes and shops", "We live in a town.", { hi: "ow" }),
    ]],
    ["oi", [
      T("coin", "a small round piece of money", "I have a coin."),
      A("point", "to show something with your finger", "Point to the moon."),
    ]],
    ["oy", [
      T("boy", "a child who will grow up to be a man", "The boy has a toy."),
      T("toy", "a thing you play with", "This toy is fun."),
    ]],
    ["igh", [
      T("night", "the time when it is dark outside", "I sleep at night.", { art: "" }),
      T("light", "what lets you see in the dark", "Turn on the light.", { art: "" }),
    ]],
    ["y", [
      T("sky", "the space above you where clouds are", "The sky is dark.", { art: "The", end: "y" }),
      D("happy", "feeling good and glad", "I am happy.", { end: "y" }),
    ]],
  ]),

  step(10, "2nd-grade words", {}, [
    [null, [
      T("friend", "someone you like and play with", "My friend is kind."),
      T("school", "the place where you go to learn", "I go to school.", { art: "" }),
      T("people", "more than one person", "Many people are at the park.", { art: "" }),
      T("animal", "a living thing like a dog, bird, or fish", "A cow is a farm animal."),
      T("family", "the people at home who love you", "I love my family."),
      T("garden", "a place where flowers and plants grow", "Corn can grow in the garden."),
      T("kitchen", "the room where food is made", "Dad is in the kitchen."),
      T("picture", "a drawing, painting, or photo", "I drew a picture."),
      T("morning", "the first part of the day", "I eat in the morning.", { art: "The" }),
      T("pencil", "a thing you write with that you can erase", "My pencil is sharp."),
      T("window", "glass in a wall that you can see through", "Look out the window."),
      T("rabbit", "a small animal with long ears that hops", "The rabbit can hop fast."),
      T("button", "a small round thing that closes a shirt", "My shirt lost a button."),
      T("basket", "a thing made to carry or hold things", "The food is in the basket."),
      T("birthday", "the day you were born", "My birthday is fun."),
      D("together", "with each other", "We play together."),
    ]],
  ]),

  step(11, "Letters you do not say", {
    kn: team("k and n", "make just the n sound. The k stays quiet: knee, knife, knock."),
    wr: team("w and r", "make just the r sound. The w stays quiet: write, wrong, wrap."),
    mb: "At the end of a word, mb makes just the m sound. The b stays quiet: lamb, thumb, climb.",
  }, [
    ["kn", [
      T("knee", "the bend in the middle of your leg", "I fell and hurt my knee."),
      T("knife", "a sharp tool for cutting food", "Dad cuts with a knife."),
      A("knock", "to hit a door so people know you are there", "Knock on the door."),
      T("knot", "a tight twist you tie in a rope", "I tied a knot in the rope."),
    ]],
    ["wr", [
      A("write", "to put words on paper", "I write my name."),
      D("wrong", "not right", "That answer is wrong."),
      A("wrap", "to put paper all the way around something", "We wrap the gift."),
      T("wrist", "the thin part between your hand and your arm", "My wrist is small."),
    ]],
    ["mb", [
      T("lamb", "a baby sheep", "The lamb stays by its mother."),
      T("thumb", "the short fat finger on your hand", "I have one thumb."),
      A("climb", "to go up something using your hands and feet", "I can climb the tree."),
      T("crumb", "a tiny bit of bread that falls off", "A crumb fell on the floor."),
    ]],
  ]),

  step(12, "When c and g go soft", {
    ce: "Before e, i, or y, the letter c says s instead of k. Listen: city, face, ice.",
    ge: "Before e, i, or y, the letter g says j instead of g. Listen: gentle, page, giant.",
    dge: team("d, g, and e", "say j at the end of a word: bridge, edge."),
  }, [
    ["ce", [
      T("city", "a very big town", "A city has many people."),
      T("circle", "a round shape with no corners", "I drew a circle."),
      A("dance", "to move your body to music", "We dance together."),
      T("face", "the front of your head", "A smile is on her face."),
      T("race", "a game to see who is fastest", "I won the race."),
      T("ice", "water that has gone hard and cold", "The ice is cold.", { art: "" }),
    ]],
    ["ge", [
      D("gentle", "soft and careful, not rough", "Be gentle with the lamb."),
      T("giant", "someone or something much bigger than normal", "The tree is a giant."),
      T("page", "one sheet in a book", "I read one page."),
      T("cage", "a box with bars that holds an animal", "The rabbit is in the cage."),
      D("large", "very big", "That is a large box."),
    ]],
    ["dge", [
      T("bridge", "a road built over water", "We drove over the bridge."),
      T("edge", "the line where something ends", "Do not stand on the edge."),
    ]],
  ]),

  step(13, "Word parts that change the meaning", {
    un: "The part un at the front of a word means not, or the opposite. Happy becomes unhappy.",
    re: "The part re at the front of a word means do it again. Tell becomes retell.",
    ful: "The part ful at the end of a word means full of it. Care becomes careful.",
    ly: "The part ly at the end of a word tells you how something is done. Slow becomes slowly.",
    ness: "The part ness at the end of a word turns it into a thing. Kind becomes kindness.",
  }, [
    ["un", [
      D("unhappy", "not happy", "She is unhappy about the rain."),
      A("unlock", "to open a lock", "I unlock the door."),
      A("undo", "to take something back to how it was", "Can you undo the knot?"),
    ]],
    ["re", [
      A("retell", "to tell it again", "I retell the story to Mom."),
      A("repaint", "to paint it again", "We repaint the old door."),
    ]],
    ["ful", [
      D("careful", "doing something slowly so nothing goes wrong", "Be careful with the knife."),
      D("helpful", "glad to help other people", "My friend is helpful."),
      D("playful", "liking to play", "The playful rabbit hops."),
    ]],
    ["ly", [
      D("slowly", "in a slow way", "The boat moves slowly."),
      D("quickly", "in a fast way", "She ran quickly to school."),
      D("softly", "in a quiet, gentle way", "He spoke softly to the lamb."),
    ]],
    ["ness", [
      T("kindness", "being kind to other people", "Her kindness made me happy."),
      T("darkness", "when there is no light at all", "The darkness came at night."),
    ]],
  ]),

  step(14, "Short ways to say two words, and long words", {
    apos: "Two words can squeeze into one. The mark shows where the letters were taken out: "
      + "do not becomes don't.",
    parts: "A long word is just short parts stuck together. Say one part at a time: "
      + "fan-tas-tic, re-mem-ber.",
  }, [
    ["apos", [
      L("don't", "I ___ want to go to bed.", ["does", "down"], "I don't like the dark."),
      L("can't", "The pig ___ climb a tree.", ["cat", "cane"], "I can't find my shoe."),
      L("isn't", "The cake ___ for you.", ["is", "it"], "That isn't my hat."),
      L("it's", "I know ___ cold out.", ["its", "it"], "It's time for bed."),
      L("we'll", "Tomorrow ___ go to the park.", ["well", "will"], "We'll be there soon."),
      L("I'm", "___ happy to see you.", ["am", "I"], "I'm reading a book."),
      L("let's", "Come on, ___ go!", ["lets", "let"], "Let's read together."),
    ]],
    ["parts", [
      D("fantastic", "really, really good", "Her reading is fantastic."),
      A("remember", "to keep something in your head and not forget it", "I remember my birthday."),
      D("important", "something that matters a lot", "Reading is important."),
      D("wonderful", "so good it makes you happy", "That was a wonderful day."),
      D("suddenly", "all at once, with no warning", "Suddenly the dog ran off."),
      T("everyone", "every person", "Everyone is here.", { art: "" }),
    ]],
  ]),
];

const sight = (list, entries) => entries.map((e) => ({ cat: null, ...e, step: 0, pat: null, list }));

export const SIGHT = [
  ...sight("pre-primer", [
    L("the", "I see ___ dog.", ["then", "they"], "The cat is on the bed."),
    L("and", "Mom ___ Dad are here.", ["an", "end"], "I like cats and dogs."),
    L("is", "The sun ___ hot.", ["it", "in"], "The dog is big."),
    L("to", "I go ___ bed.", ["do", "so"], "We went to the park."),
    L("you", "I like ___.", ["yes", "your"], "You are my friend."),
    L("said", "Mom ___ yes.", ["sad", "sit"], "Dad said it is bedtime."),
    L("here", "Come ___ now.", ["her", "he"], "Here is my hat."),
    L("come", "Can you ___ with me?", ["came", "cone"], "Come and see."),
    L("for", "This gift is ___ you.", ["far", "fur"], "I made this for Mom."),
    L("where", "I know ___ the cat is.", ["were", "we"], "Where is the dog?"),
    L("little", "The bug is ___, not big.", ["letter", "light"], "I have a little cat."),
    L("look", "Come and ___ at this.", ["lock", "like"], "Look at the moon."),
  ]),
  ...sight("primer", [
    L("he", "Dad said ___ will come.", ["her", "the"], "He is my dad."),
    L("she", "Mom said ___ is glad.", ["the", "see"], "She is my mom."),
    L("was", "The cat ___ on the bed.", ["saw", "as"], "It was hot."),
    L("are", "We ___ happy.", ["at", "or"], "You are kind."),
    L("have", "I ___ a pet.", ["has", "hat"], "We have a dog."),
    L("they", "Mom and Dad said ___ will come.", ["then", "the"], "They are at the park."),
    L("what", "I know ___ to do.", ["want", "that"], "What is in the box?"),
    L("with", "Come ___ me.", ["wish", "will"], "I play with my dog."),
    L("this", "I like ___ hat.", ["thin", "is"], "This is my bed."),
    L("there", "Put it over ___.", ["three", "they"], "There is a bug on the rug."),
    L("want", "I ___ a snack.", ["went", "what"], "I want to play."),
    L("went", "We ___ to the park.", ["want", "when"], "She went home."),
  ]),
  ...sight("first", [
    L("of", "I had a cup ___ milk.", ["off", "if"], "It is full of sand."),
    L("from", "This gift is ___ Dad.", ["form", "farm"], "I got a hug from Mom."),
    L("were", "The kids ___ at the park.", ["where", "we"], "We were glad."),
    L("could", "I wish I ___ fly.", ["cold", "cloud"], "She could not find her hat."),
    L("some", "I want ___ milk.", ["same", "so"], "I ate some cake."),
    L("know", "I ___ how to swim.", ["now", "knot"], "I know my name."),
    L("again", "Do it ___.", ["agree", "gain"], "Read it again."),
    L("her", "I gave ___ a hug.", ["here", "he"], "Her hat is big."),
  ]),
  ...sight("second", [
    L("because", "I am glad ___ you came.", ["become", "between"], "I ran because I was late."),
    L("does", "What ___ the cow say?", ["dose", "goes"], "She does her best."),
    L("their", "The kids put on ___ hats.", ["three", "then"], "It is their dog."),
    L("would", "I ___ like a snack.", ["world", "word"], "Would you like to play?"),
    L("very", "The sun is ___ hot.", ["every", "over"], "I am very happy."),
    L("many", "How ___ dogs are here?", ["money", "man"], "I have many books."),
    L("your", "Is this ___ hat?", ["you", "year"], "I like your bike."),
    L("which", "I know ___ one I want.", ["wish", "with"], "Which hat is mine?"),
  ]),
];

const ORD = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth", "eleventh", "twelfth"];
const month = (w, i, ex) => EV(w, "month", `the ${ORD[i]} month of the year`, ex);
const after = (w, prev, ex) => EV(w, "number", `the number after ${prev}`, ex);

export const EVERYDAY = [
  EV("red", "color", "the color of a fire truck", "Stop signs are red too."),
  EV("blue", "color", "the color of the sky", "The sea looks blue too."),
  EV("yellow", "color", "the color of the sun", "A banana is yellow too."),
  EV("green", "color", "the color of grass", "Frogs are green too."),
  EV("orange", "color", "the color of a pumpkin", "A carrot is orange too."),
  EV("purple", "color", "the color of grape jelly", "Some plums are purple too."),
  EV("pink", "color", "the color of a pig", "Bubble gum is pink too."),
  EV("brown", "color", "the color of chocolate", "Tree trunks are brown too."),
  EV("black", "color", "the color of the night sky", "A crow is black too."),
  EV("white", "color", "the color of snow", "Milk is white too."),
  EV("gray", "color", "the color of rain clouds", "An elephant is gray too."),

  EV("one", "number", "the first number when you count", "I have one nose."),
  after("two", "one", "I have two hands."),
  after("three", "two", "A triangle has three sides."),
  after("four", "three", "A dog has four legs."),
  after("five", "four", "One hand has five fingers."),
  after("six", "five", "A bug has six legs."),
  after("seven", "six", "A week has seven days."),
  after("eight", "seven", "A spider has eight legs."),
  after("nine", "eight", "Nine comes right before ten."),
  after("ten", "nine", "I have ten toes."),

  EV("Monday", "day", "the first day of the school week", "School starts again on Monday."),
  EV("Tuesday", "day", "the day after Monday", "Tuesday is the second school day."),
  EV("Wednesday", "day", "the day in the middle of the school week", "On Wednesday the week is half done."),
  EV("Thursday", "day", "the day after Wednesday", "Thursday comes right before Friday."),
  EV("Friday", "day", "the last day of the school week", "After Friday comes the weekend."),
  EV("Saturday", "day", "the first day of the weekend", "There is no school on Saturday."),
  EV("Sunday", "day", "the last day of the weekend", "After Sunday, a new school week starts."),
  EV("today", "time", "the day it is right now", "Today I will read."),
  EV("yesterday", "time", "the day before today", "Yesterday is over."),
  EV("tomorrow", "time", "the day after today", "Tomorrow comes after I sleep."),

  month("January", 0, "The new year starts in January."),
  month("February", 1, "February is the shortest month."),
  month("March", 2, "Spring starts in March."),
  month("April", 3, "April can bring lots of rain."),
  month("May", 4, "Flowers bloom in May."),
  month("June", 5, "Summer starts in June."),
  month("July", 6, "July is hot and sunny."),
  month("August", 7, "August is the last full month of summer."),
  month("September", 8, "Fall starts in September."),
  month("October", 9, "Leaves fall in October."),
  month("November", 10, "It gets cold in November."),
  month("December", 11, "Winter starts in December."),

  after("eleven", "ten", "Eleven is ten and one more."),
  after("twelve", "eleven", "A year has twelve months."),
  after("thirteen", "twelve", "Thirteen is ten and three more."),
  after("fourteen", "thirteen", "Fourteen is ten and four more."),
  after("fifteen", "fourteen", "Fifteen is ten and five more."),
  after("sixteen", "fifteen", "Sixteen is ten and six more."),
  after("seventeen", "sixteen", "Seventeen is ten and seven more."),
  after("eighteen", "seventeen", "Eighteen is ten and eight more."),
  after("nineteen", "eighteen", "Nineteen is ten and nine more."),
  after("twenty", "nineteen", "Twenty is two tens."),

  EV("winter", "season", "the coldest season of the year", "It can snow in winter."),
  EV("spring", "season", "the season when flowers start to grow", "Birds sing in spring."),
  EV("summer", "season", "the hottest season of the year", "We swim in summer."),
  EV("fall", "season", "the season when leaves drop from the trees", "Leaves turn colors in fall."),
];

/** What each everyday category is called in a wrong answer choice. */
export const CATEGORY_PHRASE = {
  color: "a color",
  number: "a number",
  day: "a day of the week",
  month: "a month of the year",
  season: "a season",
  time: "a word about when",
};

/** Words the recognizer may write instead of the word she said. */
export const HOMOPHONES = {
  one: ["won", "1"], two: ["to", "too", "2"], three: ["3"], four: ["for", "fore", "4"], five: ["5"],
  six: ["6"], seven: ["7"], eight: ["ate", "8"], nine: ["9"], ten: ["10"], eleven: ["11"], twelve: ["12"],
  thirteen: ["13"], fourteen: ["14"], fifteen: ["15"], sixteen: ["16"], seventeen: ["17"], eighteen: ["18"],
  nineteen: ["19"], twenty: ["20"],
  blue: ["blew"], red: ["read"], gray: ["grey"], white: ["wight"],
  to: ["too", "two", "2"], for: ["four", "fore", "4"], you: ["u", "ewe"], are: ["r"], here: ["hear"],
  know: ["no"], their: ["there", "they're"], there: ["their", "they're"], would: ["wood"], which: ["witch"],
  your: ["you're", "yore"], some: ["sum"], see: ["sea", "c"], sun: ["son"], read: ["reed", "red"],
  feet: ["feat"], tail: ["tale"], rain: ["reign", "rein"], wait: ["weight"], night: ["knight"],
  boy: ["buoy"], hurt: ["hert"], win: ["when"], when: ["win"], whip: ["wip"], be: ["bee", "b"],
  ship: ["sheep"], rich: ["reach"], chip: ["cheap"], dish: ["this"], thin: ["then", "fin"],
  march: ["march"], may: ["may"],
};

/** Plain little words stories may use even though they are not taught as lessons. */
export const HELPERS = ["a", "an", "i", "am", "at", "as", "be", "by", "do", "go", "if", "in", "it", "its",
  "me", "my", "no", "on", "or", "so", "up", "us", "we", "his", "him", "has", "had", "not", "but", "can",
  "did", "get", "got", "let", "put", "yes", "too", "off", "out", "now", "all", "oh", "mom", "dad", "then", "them",
  "that", "will", "into", "sat", "ran", "fun", "lot", "like"];

const start = (say, answer, a, b) => ({ say, where: "start", answer, choices: [answer, a, b] });
const middle = (say, answer, a, b) => ({ say, where: "middle", answer, choices: [answer, a, b] });

/** First-day letter-sound check. The word is spoken, never shown. */
export const PLACEMENT_SOUNDS = [
  start("map", "m", "n", "p"), start("sun", "s", "z", "f"), start("top", "t", "d", "k"),
  start("pig", "p", "b", "d"), start("bat", "b", "d", "p"), start("fan", "f", "v", "s"),
  start("dog", "d", "b", "g"), start("net", "n", "m", "h"), start("hat", "h", "n", "w"),
  start("cup", "c", "g", "t"), start("gum", "g", "j", "k"), start("leg", "l", "r", "w"),
  start("run", "r", "l", "w"), start("jam", "j", "g", "y"), start("kid", "k", "t", "g"),
  start("van", "v", "f", "b"), start("win", "w", "y", "r"), start("yes", "y", "w", "j"),
  start("zip", "z", "s", "x"), start("quit", "q", "p", "g"),
  { say: "fox", where: "end", answer: "x", choices: ["x", "s", "k"] },
  middle("cat", "a", "e", "u"), middle("bed", "e", "i", "a"), middle("sit", "i", "e", "a"),
  middle("hot", "o", "u", "a"), middle("sun", "u", "o", "a"),
];
