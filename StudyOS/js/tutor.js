/* ============================================================
   StudyOS — tutor.js
   Offline study "brain": explanations, quiz generation, hints,
   flashcard extraction, scan analysis, plan suggestions.

   No network calls. Everything here is rule-based so the app
   works fully offline. Swap `Tutor.reply` for an API call later.
   ============================================================ */
(function (global) {
  "use strict";

  // ------------------------------------------------------------
  //  Knowledge base — concise, curriculum-flavoured explanations
  // ------------------------------------------------------------
  const KB = [
    { keys: ["photosynthesis"], title: "Photosynthesis",
      simple: "Plants make their own food using sunlight, water and carbon dioxide.",
      detail: "Chlorophyll in the leaves absorbs sunlight. That energy splits water and combines carbon dioxide into glucose, releasing oxygen.",
      formula: "6CO₂ + 6H₂O + light → C₆H₁₂O₆ + 6O₂",
      points: ["Happens mainly in the chloroplasts of leaf cells.", "Chlorophyll (green pigment) captures light energy.", "Glucose stores the energy; oxygen is released as a by-product.", "Needs: sunlight, water, CO₂, chlorophyll."] },

    { keys: ["cell", "unit of life"], title: "The Cell",
      simple: "The cell is the smallest living unit — every organism is built from cells.",
      detail: "Cells have a membrane, cytoplasm and genetic material. Prokaryotic cells (bacteria) lack a true nucleus; eukaryotic cells have one.",
      points: ["Cell membrane controls what enters and leaves.", "Nucleus holds DNA and directs activity.", "Mitochondria release energy (ATP).", "Plant cells also have a cell wall and chloroplasts."] },

    { keys: ["quadratic", "quadratic equation"], title: "Quadratic Equations",
      simple: "An equation where the highest power of x is 2, like ax² + bx + c = 0.",
      detail: "Solve by factorising, completing the square, or the quadratic formula. The discriminant b² − 4ac tells you how many real roots exist.",
      formula: "x = (−b ± √(b² − 4ac)) / 2a",
      points: ["b² − 4ac > 0 → two distinct real roots.", "b² − 4ac = 0 → one repeated root.", "b² − 4ac < 0 → no real roots.", "Sum of roots = −b/a, product = c/a."] },

    { keys: ["polynomial", "degree"], title: "Polynomials",
      simple: "An expression of terms with whole-number powers of a variable.",
      detail: "The degree is the highest power present. Linear = degree 1, quadratic = 2, cubic = 3.",
      points: ["3x² + 2x + 1 has degree 2.", "A zero of p(x) is a value where p(x) = 0.", "Remainder theorem: p(a) is the remainder when dividing by (x − a).", "Factor theorem: (x − a) is a factor if p(a) = 0."] },

    { keys: ["coordinate geometry", "cartesian", "axes"], title: "Coordinate Geometry",
      simple: "Describing points and shapes using number pairs on a grid.",
      detail: "The x-axis and y-axis meet at the origin (0, 0) and split the plane into four quadrants. A point is written (x, y).",
      formula: "Distance = √((x₂−x₁)² + (y₂−y₁)²)",
      points: ["(0, 5) lies on the y-axis; (5, 0) lies on the x-axis.", "Quadrant I: both positive. II: (−,+). III: (−,−). IV: (+,−).", "Midpoint = ((x₁+x₂)/2, (y₁+y₂)/2)."] },

    { keys: ["linear equation", "two variables"], title: "Linear Equations",
      simple: "Equations where variables appear only to the first power.",
      detail: "A linear equation in two variables (ax + by + c = 0) graphs as a straight line and has infinitely many solutions. A pair of them may have one, none or infinite common solutions.",
      points: ["One variable → exactly one solution.", "Two variables → a straight line of solutions.", "Solve pairs by substitution, elimination or graphing."] },

    { keys: ["newton", "laws of motion", "motion", "force"], title: "Newton's Laws of Motion",
      simple: "Three rules that describe how forces change motion.",
      detail: "1) An object stays at rest or in uniform motion unless a net force acts. 2) Force equals mass times acceleration. 3) Every action has an equal, opposite reaction.",
      formula: "F = ma",
      points: ["Inertia depends on mass.", "Acceleration is in the direction of the net force.", "Action and reaction act on different bodies.", "Momentum p = mv is conserved with no external force."] },

    { keys: ["chemical reaction", "balancing", "equation"], title: "Chemical Reactions",
      simple: "Substances rearrange into new substances with new properties.",
      detail: "Balance an equation so each element has the same atom count on both sides — mass is conserved.",
      formula: "Zn + 2HCl → ZnCl₂ + H₂",
      points: ["Types: combination, decomposition, displacement, double displacement, redox.", "Signs of a reaction: gas, colour change, precipitate, temperature change.", "Never change subscripts to balance — only coefficients."] },

    { keys: ["atom", "molecule", "atomic"], title: "Atoms & Molecules",
      simple: "Atoms are the building blocks; molecules are atoms joined together.",
      detail: "An atom has protons and neutrons in the nucleus with electrons around it. Atomic number = number of protons.",
      points: ["Protons: positive. Electrons: negative. Neutrons: neutral.", "Mole = 6.022 × 10²³ particles.", "Molecular mass = sum of atomic masses."] },

    { keys: ["trigonometry", "sin", "cos", "tan"], title: "Trigonometry Basics",
      simple: "Relationships between angles and side lengths in right triangles.",
      detail: "For a right triangle: sine is opposite/hypotenuse, cosine is adjacent/hypotenuse, tangent is opposite/adjacent.",
      formula: "sin²θ + cos²θ = 1",
      points: ["SOH-CAH-TOA is the memory hook.", "sin 30° = 1/2, cos 60° = 1/2, tan 45° = 1.", "tan θ = sin θ / cos θ."] },

    { keys: ["fraction", "lcm", "hcf"], title: "Fractions, LCM & HCF",
      simple: "LCM is the smallest common multiple; HCF is the largest common factor.",
      detail: "Use prime factorisation: HCF takes the lowest powers of shared primes, LCM takes the highest powers of all primes.",
      formula: "HCF × LCM = product of the two numbers",
      points: ["Add fractions by converting to a common denominator (the LCM).", "Simplify by dividing by the HCF."] },

    { keys: ["french revolution"], title: "The French Revolution",
      simple: "A period from 1789 when the French people overthrew the monarchy.",
      detail: "Heavy taxes, food shortages and an unfair estate system triggered revolt. The Bastille fell on 14 July 1789, and a republic followed.",
      points: ["Three estates: clergy, nobility, commoners — only the third paid most taxes.", "Declaration of the Rights of Man (1789).", "Louis XVI executed in 1793; Reign of Terror followed.", "Slogan: liberty, equality, fraternity."] },

    { keys: ["grammar", "tense", "parts of speech"], title: "Grammar Essentials",
      simple: "Parts of speech and tenses are the skeleton of a sentence.",
      detail: "Eight parts of speech: noun, pronoun, verb, adjective, adverb, preposition, conjunction, interjection. Tense shows when an action happens.",
      points: ["Subject-verb agreement: singular subject → singular verb.", "Active voice is usually clearer than passive.", "Present perfect links past action to now: 'I have finished'."] },

    { keys: ["probability"], title: "Probability",
      simple: "How likely something is, between 0 (never) and 1 (certain).",
      detail: "For equally likely outcomes, probability = favourable outcomes ÷ total outcomes.",
      formula: "P(E) = n(E) / n(S)",
      points: ["P(not E) = 1 − P(E).", "A single die: P(even) = 3/6 = 1/2.", "Probabilities of all outcomes sum to 1."] },

    { keys: ["statistics", "mean", "median", "mode"], title: "Mean, Median & Mode",
      simple: "Three ways of describing the 'middle' of a data set.",
      detail: "Mean is the average, median is the middle value when sorted, mode is the most frequent value.",
      formula: "Mean = Σx / n",
      points: ["Median is better when there are extreme values.", "A data set can have more than one mode.", "For grouped data, use class midpoints for the mean."] },
  ];

  function findTopic(text) {
    const q = String(text).toLowerCase();
    let best = null, bestLen = 0;
    KB.forEach((e) => e.keys.forEach((k) => {
      if (q.includes(k) && k.length > bestLen) { best = e; bestLen = k.length; }
    }));
    return best;
  }

  // ------------------------------------------------------------
  //  Question bank for quiz generation
  // ------------------------------------------------------------
  const BANK = {
    "Mathematics": [
      { q: "What is the degree of the polynomial 3x² + 2x + 1?", opts: ["1", "2", "3", "0"], a: 1, why: "Degree is the highest power of x, which is 2." },
      { q: "The point (0, 5) lies on which axis?", opts: ["x-axis", "y-axis", "Origin", "Neither"], a: 1, why: "x = 0 means the point sits on the y-axis." },
      { q: "√144 equals?", opts: ["11", "12", "13", "14"], a: 1, why: "12 × 12 = 144." },
      { q: "A linear equation in two variables has how many solutions?", opts: ["One", "Two", "None", "Infinitely many"], a: 3, why: "Every point on the line is a solution." },
      { q: "The sum of the angles of a triangle is?", opts: ["90°", "180°", "270°", "360°"], a: 1, why: "Angle sum property of a triangle." },
      { q: "For ax² + bx + c = 0, the sum of roots is?", opts: ["c/a", "−b/a", "b/a", "−c/a"], a: 1, why: "Sum = −b/a, product = c/a." },
      { q: "Which quadrant contains the point (−3, −4)?", opts: ["I", "II", "III", "IV"], a: 2, why: "Both coordinates negative → Quadrant III." },
      { q: "HCF × LCM of two numbers equals?", opts: ["Their sum", "Their difference", "Their product", "Their ratio"], a: 2, why: "HCF × LCM = product of the numbers." },
      { q: "If p(x) = x² − 4, what is p(2)?", opts: ["0", "2", "4", "−4"], a: 0, why: "2² − 4 = 0, so 2 is a zero of p(x)." },
      { q: "Median of 3, 7, 9, 15, 21 is?", opts: ["7", "9", "11", "15"], a: 1, why: "Middle value of the sorted list is 9." },
      { q: "tan 45° equals?", opts: ["0", "1", "√3", "1/2"], a: 1, why: "Opposite equals adjacent at 45°." },
      { q: "P(getting an even number on a die) is?", opts: ["1/6", "1/3", "1/2", "2/3"], a: 2, why: "3 even faces out of 6 → 1/2." },
    ],
    "Science": [
      { q: "What is the basic unit of life?", opts: ["Atom", "Cell", "Molecule", "Tissue"], a: 1, why: "All living organisms are made of cells." },
      { q: "Which gas do plants absorb for photosynthesis?", opts: ["Oxygen", "Nitrogen", "Carbon dioxide", "Hydrogen"], a: 2, why: "CO₂ is taken in through stomata." },
      { q: "The chemical formula for water is?", opts: ["H₂O", "CO₂", "O₂", "NaCl"], a: 0, why: "Two hydrogen atoms and one oxygen atom." },
      { q: "Speed is measured in?", opts: ["kg", "m/s", "N", "J"], a: 1, why: "Distance per unit time." },
      { q: "Atoms consist of protons, neutrons and?", opts: ["Ions", "Electrons", "Cells", "Photons"], a: 1, why: "Electrons orbit the nucleus." },
      { q: "Newton's second law states?", opts: ["F = ma", "E = mc²", "PV = nRT", "v = u + at"], a: 0, why: "Force equals mass times acceleration." },
      { q: "Which organelle releases energy in a cell?", opts: ["Ribosome", "Mitochondrion", "Nucleus", "Vacuole"], a: 1, why: "Mitochondria produce ATP." },
      { q: "Zn + 2HCl → ZnCl₂ + ? ", opts: ["O₂", "H₂", "Cl₂", "H₂O"], a: 1, why: "Hydrogen gas is displaced by zinc." },
      { q: "Which pigment makes leaves green?", opts: ["Haemoglobin", "Chlorophyll", "Carotene", "Melanin"], a: 1, why: "Chlorophyll absorbs light for photosynthesis." },
      { q: "The SI unit of force is?", opts: ["Joule", "Newton", "Watt", "Pascal"], a: 1, why: "1 N = 1 kg·m/s²." },
      { q: "Inertia of a body depends on its?", opts: ["Speed", "Mass", "Shape", "Colour"], a: 1, why: "More mass means more inertia." },
      { q: "A precipitate forming usually indicates?", opts: ["No reaction", "A chemical reaction", "Evaporation", "Melting"], a: 1, why: "An insoluble new substance has formed." },
    ],
    "Social Science": [
      { q: "The French Revolution began in which year?", opts: ["1776", "1789", "1799", "1804"], a: 1, why: "The Bastille fell on 14 July 1789." },
      { q: "Which estate paid most of the taxes in France?", opts: ["First", "Second", "Third", "None"], a: 2, why: "Commoners in the third estate carried the tax burden." },
      { q: "The slogan of the French Revolution was?", opts: ["Bread and peace", "Liberty, equality, fraternity", "Rule of law", "One nation"], a: 1, why: "Liberté, égalité, fraternité." },
      { q: "The Himalayas are an example of?", opts: ["Fold mountains", "Block mountains", "Volcanic mountains", "Plateaus"], a: 0, why: "Formed by the collision of tectonic plates." },
      { q: "The Northern Plains of India are formed by?", opts: ["Volcanoes", "River deposits", "Glaciers only", "Wind"], a: 1, why: "Alluvium deposited by the Indus, Ganga and Brahmaputra." },
    ],
    "English": [
      { q: "How many parts of speech are there in English?", opts: ["Six", "Seven", "Eight", "Nine"], a: 2, why: "Noun, pronoun, verb, adjective, adverb, preposition, conjunction, interjection." },
      { q: "'She has finished her homework' is in which tense?", opts: ["Simple past", "Present perfect", "Past perfect", "Future"], a: 1, why: "'has + past participle' is present perfect." },
      { q: "Which word is an adverb: 'He ran quickly home'?", opts: ["He", "ran", "quickly", "home"], a: 2, why: "'Quickly' modifies the verb 'ran'." },
      { q: "The passive form of 'They built the house' is?", opts: ["The house built them", "The house was built", "They were building", "House builds"], a: 1, why: "Object becomes subject with 'was/were + past participle'." },
      { q: "A synonym for 'diligent' is?", opts: ["Lazy", "Hardworking", "Angry", "Careless"], a: 1, why: "Diligent means showing careful, persistent effort." },
    ],
    "General Knowledge": [
      { q: "Consistency in studying is built mainly through?", opts: ["Cramming", "Daily short sessions", "Skipping days", "Luck"], a: 1, why: "Spaced, regular practice beats last-minute cramming." },
      { q: "Spaced repetition works because it?", opts: ["Fills time", "Interrupts forgetting", "Is entertaining", "Avoids hard topics"], a: 1, why: "Reviewing just before you forget strengthens recall." },
      { q: "Active recall means?", opts: ["Rereading notes", "Testing yourself", "Highlighting", "Watching videos"], a: 1, why: "Retrieving information strengthens memory more than rereading." },
      { q: "A Pomodoro session is usually?", opts: ["10 min", "25 min", "60 min", "90 min"], a: 1, why: "25 minutes of focus, then a 5-minute break." },
    ],
  };

  // Template generators so any subject/chapter can produce a quiz
  function genFromChapter(subjectName, chapterName, count, difficulty) {
    const pool = (BANK[subjectName] || []).slice();
    const generic = [
      { q: `Which of these best describes the focus of "${chapterName}"?`, opts: ["A single formula", "A connected set of concepts", "Only definitions", "Nothing examinable"], a: 1, why: "Chapters build a connected set of ideas, not isolated facts." },
      { q: `Before a test on "${chapterName}", the most effective first step is to?`, opts: ["Reread everything", "Self-test on key points", "Highlight the chapter", "Watch a video"], a: 1, why: "Self-testing shows you exactly what you don't know yet." },
      { q: `You scored 40% on "${chapterName}". The best next action is?`, opts: ["Move to the next chapter", "Revise the weak parts, then retest", "Skip it", "Study a different subject"], a: 1, why: "Targeted revision followed by a retest closes the gap." },
      { q: `Spacing your revision of "${chapterName}" over several days mainly improves?`, opts: ["Speed of reading", "Long-term retention", "Handwriting", "Nothing"], a: 1, why: "Spacing interrupts forgetting and builds durable memory." },
    ];
    let all = U.shuffle(pool).concat(U.shuffle(generic));
    if (difficulty === "hard") all = all.slice().reverse();
    return all.slice(0, count || 5).map((x) => Object.assign({}, x, { opts: x.opts.slice() }));
  }

  const Tutor = {
    subjectsWithBank() { return Object.keys(BANK); },
    bankFor(subject) { return BANK[subject] || []; },

    /** Build a quiz. opts: { subject, chapter, count, difficulty, type } */
    makeQuiz(opts) {
      const o = Object.assign({ subject: "General Knowledge", chapter: "", count: 5, difficulty: "medium" }, opts);
      let qs;
      if (o.chapter) qs = genFromChapter(o.subject, o.chapter, o.count, o.difficulty);
      else {
        const pool = BANK[o.subject] || BANK["General Knowledge"];
        qs = U.shuffle(pool).slice(0, o.count);
      }
      // shuffle options while tracking the answer
      qs = qs.map((item) => {
        const pairs = item.opts.map((text, i) => ({ text, correct: i === item.a }));
        const mixed = U.shuffle(pairs);
        return { q: item.q, opts: mixed.map((p) => p.text), a: mixed.findIndex((p) => p.correct), why: item.why || "" };
      });
      return { subject: o.subject, chapter: o.chapter, difficulty: o.difficulty, questions: qs };
    },

    /** Turn note text into flashcards. Handles "Term: definition" and sentences. */
    cardsFromText(text, limit) {
      const cards = [];
      const lines = String(text).split(/\n+/).map((l) => l.trim()).filter(Boolean);
      lines.forEach((line) => {
        const m = line.match(/^([^:]{3,60}):\s*(.+)$/);
        if (m) { cards.push({ front: `What is ${m[1].trim()}?`, back: m[2].trim() }); return; }
        const d = line.match(/^(.{3,60}?)\s+(?:is|are|means|refers to)\s+(.+)$/i);
        if (d) { cards.push({ front: `What ${/s$/.test(d[1]) ? "are" : "is"} ${d[1].trim()}?`, back: d[2].trim().replace(/\.$/, "") }); return; }
        if (line.length > 25 && line.length < 220) {
          const words = line.split(/\s+/);
          if (words.length > 6) {
            const idx = words.findIndex((w, i) => i > 1 && w.length > 5);
            if (idx > 0) {
              const target = words[idx].replace(/[^\w-]/g, "");
              cards.push({ front: words.map((w, i) => (i === idx ? "_____" : w)).join(" "), back: target });
            }
          }
        }
      });
      return cards.slice(0, limit || 12);
    },

    /** Fake-but-useful "scan" analysis of pasted or typed page text. */
    analyseText(text, name) {
      const clean = String(text).replace(/\s+/g, " ").trim();
      const sentences = clean.split(/(?<=[.!?])\s+/).filter((s) => s.length > 20);
      const topic = findTopic(clean);
      const words = clean.toLowerCase().match(/[a-z]{5,}/g) || [];
      const stop = new Set(["about","after","again","their","there","these","those","which","would","could","should","because","between","through","during","before","other","being","where","while","under","above","every","first","never","often","using","include","includes","called","known"]);
      const freq = {};
      words.forEach((w) => { if (!stop.has(w)) freq[w] = (freq[w] || 0) + 1; });
      const keywords = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([w]) => w);

      const summary = topic
        ? `${topic.title}: ${topic.simple} ${topic.detail}`
        : (sentences.slice(0, 2).join(" ") || clean.slice(0, 220) || "Not enough text to summarise.");

      const points = topic ? topic.points.slice(0, 5)
        : sentences.slice(0, 5).map((s) => s.length > 150 ? s.slice(0, 147) + "…" : s);

      return {
        name: name || "Scanned page",
        summary,
        points: points.length ? points : ["Add more text for a detailed breakdown."],
        keywords,
        cards: this.cardsFromText(clean, 8),
        topicTitle: topic ? topic.title : null,
      };
    },

    /** Suggest study blocks for a date, weighted to weak topics and exams. */
    suggestPlan(dateISO, totalMinutes) {
      const budget = totalMinutes || Store.state.profile.dailyGoalMin || 120;
      const blocks = [];
      const queue = Store.revisionQueue(6);
      const exams = Store.upcomingExams();
      const urgentSubjects = new Set(exams.filter((e) => U.daysBetween(U.todayISO(), e.date) <= 7).map((e) => e.subject));

      // order: exam subjects first, then weakest
      const ordered = queue.slice().sort((a, b) => {
        const au = urgentSubjects.has(a.subject.name) ? 1 : 0;
        const bu = urgentSubjects.has(b.subject.name) ? 1 : 0;
        return bu - au || b.score - a.score;
      });

      let clock = 16 * 60; // 16:00
      let left = budget;
      for (const item of ordered) {
        if (left < 20) break;
        const len = left >= 45 ? 45 : left >= 30 ? 30 : 20;
        const start = fmtClock(clock);
        const end = fmtClock(clock + len);
        blocks.push({
          id: U.uid(), dateISO, start, end,
          subject: item.subject.name, chapter: item.chapter.name,
          note: urgentSubjects.has(item.subject.name) ? "Exam soon" : (item.gap >= 7 ? "Overdue revision" : "Weak topic"),
          done: false,
        });
        clock += len + 10; // break
        left -= len;
      }
      return blocks;

      function fmtClock(mins) {
        const h = Math.floor(mins / 60) % 24, m = mins % 60;
        return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      }
    },

    /** Plain-language interpretation of the week's numbers. */
    weeklyInsight() {
      const s = Store.state;
      const days = U.lastNDays(7);
      const mins = days.map((d) => Store.minutesOn(d));
      const total = U.sum(mins);
      const prev = U.lastNDays(14).slice(0, 7).map((d) => Store.minutesOn(d));
      const prevTotal = U.sum(prev);
      const ranking = Store.subjectRanking();
      const best = mins.indexOf(Math.max(...mins));
      const out = [];

      if (total === 0) {
        out.push({ tone: "warn", ic: "🌱", text: "No sessions logged this week yet. Start with one 25-minute session — that's all it takes to restart the streak." });
        return out;
      }
      const delta = total - prevTotal;
      if (prevTotal > 0 && Math.abs(delta) > 20) {
        out.push(delta > 0
          ? { tone: "good", ic: "📈", text: `You studied ${U.fmtMin(delta)} more than last week (${U.fmtMin(total)} total). The habit is building.` }
          : { tone: "warn", ic: "📉", text: `You studied ${U.fmtMin(-delta)} less than last week (${U.fmtMin(total)} total). Not a problem — just aim for one extra session.` });
      } else {
        out.push({ tone: "", ic: "⏱️", text: `${U.fmtMin(total)} of focused study this week, averaging ${U.fmtMin(total / 7)} a day.` });
      }
      if (mins[best] > 0) out.push({ tone: "", ic: "📅", text: `${U.dayName(days[best], true)} was your most productive day (${U.fmtMin(mins[best])}). Consider scheduling harder topics then.` });

      const weakest = ranking[ranking.length - 1];
      const strongest = ranking[0];
      if (weakest && strongest && ranking.length > 1) {
        out.push({ tone: "warn", ic: "🎯", text: `${weakest.name} sits at ${weakest.avg}% while ${strongest.name} is at ${strongest.avg}%. Two sessions on ${weakest.name} this week would close most of that gap.` });
      }
      const quizzes = s.quizResults.filter((r) => days.includes(r.dateISO));
      if (quizzes.length) {
        const acc = U.pct(U.sum(quizzes, "score"), U.sum(quizzes, "total"));
        out.push({ tone: acc >= 75 ? "good" : "warn", ic: "❓", text: `${quizzes.length} quiz${quizzes.length !== 1 ? "zes" : ""} at ${acc}% accuracy. ${acc >= 75 ? "Strong recall — keep spacing your reviews." : "Below 75% usually means the material needs revising, not more testing."}` });
      } else {
        out.push({ tone: "", ic: "❓", text: "No quizzes this week. A 5-question quiz shows what you actually remember far faster than rereading." });
      }
      const overdue = Store.overdueHomework().length;
      if (overdue) out.push({ tone: "warn", ic: "⚠️", text: `${overdue} homework task${overdue !== 1 ? "s are" : " is"} overdue. Clearing the oldest one first usually feels the best.` });
      return out;
    },

    // ------------------------------------------------------------
    //  Chat reply — the "tutor" itself
    // ------------------------------------------------------------
    reply(input) {
      const raw = String(input).trim();
      const q = raw.toLowerCase();
      if (!raw) return { text: "Ask me anything about your subjects." };

      // --- what should I study? ---
      if (/(what|which).*(study|do).*(today|now|next)|what should i (study|do)/.test(q)) {
        const queue = Store.revisionQueue(3);
        if (!queue.length) return { text: "Add a subject and a couple of chapters first — then I can tell you exactly what to work on." };
        const top = queue[0];
        const lines = [
          `**Start with ${top.subject.name} — ${top.chapter.name}.**`,
          `Understanding sits at ${top.chapter.progress}%${top.gap >= 5 ? `, and you last revised it ${top.gap} days ago` : ""}.`,
          "",
          "**Suggested 45 minutes**",
          "1. 20 min — reread your notes and rewrite the key ideas from memory",
          "2. 15 min — work 5 practice questions",
          "3. 10 min — take a 5-question quiz in StudyOS to check it stuck",
          "",
          "After that, the next two on your list are:",
          ...queue.slice(1).map((x) => `• ${x.subject.name} — ${x.chapter.name} (${x.chapter.progress}%)`),
        ];
        return { text: lines.join("\n"), actions: [{ label: "⏱️ Start timer", go: "timer" }, { label: "❓ Quiz me", go: "quiz" }] };
      }

      // --- test me / quiz me ---
      if (/(test|quiz) me|give me (some )?(mcq|questions|a quiz)|\bmcqs?\b/.test(q)) {
        let subject = Tutor.subjectsWithBank().find((s) => q.includes(s.toLowerCase()));
        if (!subject) {
          const match = Store.state.subjects.find((s) => q.includes(s.name.toLowerCase()));
          subject = match ? match.name : null;
        }
        const num = (q.match(/\b(\d{1,2})\b/) || [])[1];
        return {
          text: `Sure — I'll set up ${num ? num : 5} questions${subject ? ` on ${subject}` : ""}. Quizzes are scored and feed straight into your weak-topic tracking.`,
          quiz: { subject: subject || "General Knowledge", count: U.clamp(parseInt(num || 5, 10), 3, 12) },
        };
      }

      // --- hint / stuck / don't understand ---
      if (/(hint|stuck|don'?t (get|understand)|confus|help me solve)/.test(q)) {
        const topic = findTopic(q);
        const lines = ["Let's work it out in steps rather than jumping to the answer."];
        if (topic) {
          lines.push("", `**Concept you need:** ${topic.title}`, topic.simple);
          if (topic.formula) lines.push("", `**Key relation:** \`${topic.formula}\``);
        }
        lines.push("",
          "**1. Hint** — write down exactly what you're given and what you're asked for. Most confusion comes from a missing link between those two.",
          "**2. Method** — name the rule that connects them" + (topic && topic.formula ? ` (here, \`${topic.formula}\`)` : "") + ".",
          "**3. Try one line** — do only the first step, then check whether the units and signs still make sense.",
          "",
          "Paste your working and I'll tell you which line goes wrong.");
        return { text: lines.join("\n") };
      }

      // --- harder question ---
      if (/harder|more difficult|tougher|challenge me/.test(q)) {
        return { text: "Right — stepping up the difficulty. I'll bias towards multi-step questions where you have to pick the method yourself.", quiz: { subject: "Mathematics", count: 5, difficulty: "hard" } };
      }

      // --- explain like I'm N / simply ---
      const eli = q.match(/like i'?m (?:in )?(?:class |grade )?(\d{1,2})|simpl(?:y|e)|in easy words/);
      const topic = findTopic(q);
      if (topic) {
        const simpleMode = !!eli;
        const lines = [`**${topic.title}**`, "", simpleMode ? topic.simple : `${topic.simple} ${topic.detail}`];
        if (topic.formula) lines.push("", `\`${topic.formula}\``);
        lines.push("", "**Key points**", ...topic.points.map((p) => `• ${p}`));
        lines.push("", simpleMode
          ? "Want me to go one level deeper, or test you on it?"
          : "Want this simpler, a worked example, or a quick quiz on it?");
        return { text: lines.join("\n"), actions: [{ label: "❓ Quiz me on this", quiz: { subject: guessSubject(topic), count: 5 } }] };
      }

      // --- summarise my notes ---
      if (/summar/.test(q)) {
        const notes = [];
        Store.allChapters().forEach(({ subject, chapter }) => (chapter.notes || []).forEach((n) => notes.push({ subject, chapter, n })));
        if (!notes.length) return { text: "You don't have notes saved yet. Add one under any chapter and I'll summarise it and turn it into flashcards." };
        const latest = notes.sort((a, b) => (b.n.ts || 0) - (a.n.ts || 0))[0];
        const a = Tutor.analyseText(latest.n.body, latest.n.title);
        return { text: [`**${latest.n.title}** — ${latest.subject.name} / ${latest.chapter.name}`, "", a.summary, "", "**Key points**", ...a.points.map((p) => `• ${p}`)].join("\n") };
      }

      // --- how am I doing ---
      if (/how am i doing|my progress|am i improving/.test(q)) {
        const ins = Tutor.weeklyInsight();
        return { text: ["Here's the honest read on this week:", "", ...ins.map((i) => `${i.ic} ${i.text}`)].join("\n"), actions: [{ label: "📊 Open progress", go: "progress" }] };
      }

      // --- greetings ---
      if (/^(hi|hey|hello|yo|sup)\b/.test(q)) {
        const name = Store.state.profile.name || "there";
        return { text: `Hey ${name}. Ask me to explain a topic, set a quiz, or tell you what to study next.` };
      }
      if (/thank/.test(q)) return { text: "Anytime. Want a quick quiz to lock it in?" };

      // --- fallback: still useful ---
      const known = KB.slice(0, 6).map((k) => k.title);
      return {
        text: [
          "I don't have a prepared explanation for that one — I run fully offline, so my knowledge is a curated set of curriculum topics.",
          "",
          "Things I can do right now:",
          "• Explain a topic — try *\"explain photosynthesis like I'm in class 7\"*",
          "• Set a quiz — *\"give me 10 MCQs on Science\"*",
          "• Tell you what to study next — *\"what should I study today?\"*",
          "• Summarise your saved notes into flashcards",
          "",
          `Topics I know well include: ${known.join(", ")} and more.`,
        ].join("\n"),
      };
    },

    starterPrompts() {
      return [
        "What should I study today?",
        "Explain photosynthesis like I'm in class 7",
        "Give me 10 MCQs on Science",
        "I don't understand quadratic equations",
        "How am I doing this week?",
      ];
    },
  };

  function guessSubject(topic) {
    const t = (topic.title + " " + topic.keys.join(" ")).toLowerCase();
    if (/polynomial|quadratic|coordinate|linear|trigonometry|fraction|probability|statistic|mean/.test(t)) return "Mathematics";
    if (/photosynth|cell|atom|newton|motion|chemical/.test(t)) return "Science";
    if (/revolution/.test(t)) return "Social Science";
    if (/grammar/.test(t)) return "English";
    return "General Knowledge";
  }

  global.Tutor = Tutor;
})(window);
