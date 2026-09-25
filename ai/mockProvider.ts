import { AIProvider, ChatMessage, GenerateOptions, GenerationMetrics } from './provider';
import { resolveResponseLanguage } from './languageDetector';

export class MockAIProvider implements AIProvider {
  public id = 'mock';
  public name = 'Mock Study Assistant';

  public async isAvailable(): Promise<boolean> {
    return true;
  }

  public async generateResponse(
    history: ChatMessage[],
    options?: GenerateOptions
  ): Promise<string> {
    const startTime = performance.now();
    options?.callbacks?.onStart?.();

    const lastUserMsg = [...history].reverse().find((m) => m.role === 'user');
    const prompt = lastUserMsg ? lastUserMsg.content.trim().toLowerCase() : '';
    const sys = options?.systemPrompt?.toLowerCase() || '';

    // Determine target response language
    const targetLang = resolveResponseLanguage(lastUserMsg?.content || '', options?.systemPrompt);
    const isBanglaOrBanglish = targetLang === 'bn' || targetLang === 'banglish' || sys.includes('bengali') || sys.includes('বাংলা');

    // Context from prior turns in this conversation
    const priorUserMsgs = history.filter(m => m.role === 'user' && m !== lastUserMsg);
    const priorContextText = priorUserMsgs.map(m => m.content.toLowerCase()).join(' ');

    let fullText = '';

    if (sys.includes('testing and assessment') || prompt.includes('"type": "mcq"') || prompt.includes('generate quiz') || prompt.includes('questions for the topic:') || (prompt.includes('questions') && prompt.includes('format must be valid json'))) {
      const isTrueFalse = prompt.includes('true_false');
      const isShortAnswer = prompt.includes('short_answer');
      const countMatch = prompt.match(/exactly\s*(\d+)/i);
      const requestedCount = countMatch ? parseInt(countMatch[1], 10) : 5;

      const mockQuestions = [];
      for (let i = 1; i <= requestedCount; i++) {
        if (isTrueFalse) {
          mockQuestions.push({
            question: `Statement ${i}: Virtual memory isolates the process address space from physical RAM.`,
            type: "true_false",
            options: ["True", "False"],
            correctAnswer: "True",
            explanation: "Virtual memory creates an abstraction layer ensuring each process has an isolated virtual address space."
          });
        } else if (isShortAnswer) {
          mockQuestions.push({
            question: `Question ${i}: What is the primary purpose of paging in an operating system?`,
            type: "short_answer",
            options: [],
            correctAnswer: "To eliminate external fragmentation by mapping non-contiguous physical memory frames to contiguous virtual pages.",
            explanation: "Paging divides memory into fixed-size frames and pages, preventing external fragmentation."
          });
        } else {
          mockQuestions.push({
            question: `Question ${i}: Which algorithm selects the process with the shortest burst time?`,
            type: "mcq",
            options: [
              "Shortest Job First (SJF)",
              "First-Come, First-Served (FCFS)",
              "Round Robin (RR)",
              "Priority Scheduling"
            ],
            correctAnswer: 0,
            explanation: "Shortest Job First (SJF) schedules the process with the smallest CPU burst next, minimizing average waiting time."
          });
        }
      }
      fullText = JSON.stringify(mockQuestions, null, 2);
    } else if (sys.includes('study card generator') || prompt.includes('high-yield flashcards') || (prompt.includes('flashcard') && prompt.includes('json'))) {
      const countMatch = prompt.match(/exactly\s*(\d+)/i);
      const requestedCount = countMatch ? parseInt(countMatch[1], 10) : 5;
      const mockCards = [];
      const samples = [
        { front: "Virtual Memory", back: "A memory management technique that provides an idealized abstraction of storage resources." },
        { front: "Page Fault", back: "An interrupt raised by hardware when a running program accesses a memory page not currently mapped in RAM." },
        { front: "TLB (Translation Lookaside Buffer)", back: "A high-speed hardware cache used by the MMU to reduce virtual-to-physical address translation time." },
        { front: "Thrashing", back: "A state where the CPU spends more time swapping pages in and out of swap space than executing user instructions." },
        { front: "Belady's Anomaly", back: "The phenomenon where increasing page frames causes an increase in page faults under FIFO page replacement." },
        { front: "Demand Paging", back: "Loading pages into physical memory only when they are referenced during execution." }
      ];
      for (let i = 0; i < requestedCount; i++) {
        mockCards.push(samples[i % samples.length]);
      }
      fullText = JSON.stringify(mockCards, null, 2);
    } else if (sys.includes('academic study planner') || prompt.includes('offline study plan') || (prompt.includes('study plan') && prompt.includes('json'))) {
      const daysMatch = prompt.match(/total available days:\s*(\d+)/i);
      const days = daysMatch ? parseInt(daysMatch[1], 10) : 7;
      const mockSchedule = [];
      const topics = [
        "Core Concepts & Definitions",
        "Architecture & Mechanisms",
        "Practical Examples & Code Analysis",
        "Problem Solving & Edge Cases",
        "Advanced Scenarios & Tradeoffs",
        "Practice Exam & Self-Quiz",
        "Final Review & Quick Revision"
      ];
      for (let d = 1; d <= days; d++) {
        mockSchedule.push({
          day: d,
          topic: topics[(d - 1) % topics.length],
          estimatedDuration: "2 hours",
          activity: `Deep dive study and exercises on ${topics[(d - 1) % topics.length]}.`,
          revisionTask: "Flashcard review and active recall summary."
        });
      }
      fullText = JSON.stringify(mockSchedule, null, 2);
    } else if (prompt.includes('### simple definition') || prompt.includes('format your response strictly using these sections:')) {
      fullText = `### Simple Definition
A virtual memory system is an operating system mechanism that provides each process with a large, private, and contiguous address space mapped to physical RAM and secondary storage.

### How It Works
The Memory Management Unit (MMU) translates virtual addresses generated by the CPU into physical addresses using page tables. When a requested page is not in physical RAM, a page fault occurs, loading the missing page from disk.

### Important Components
- Page Table & Translation Lookaside Buffer (TLB)
- Memory Management Unit (MMU)
- Frame allocation and Page replacement algorithms

### Concrete Example
When a game requiring 16 GB of memory runs on an 8 GB RAM system, virtual memory dynamically pages inactive assets out to an SSD swap file, allowing the application to execute seamlessly.

### Exam-Focused Points
- Distinguish between internal fragmentation (present in paging) vs external fragmentation (present in segmentation).
- Understand how TLB hit ratio directly determines Effective Access Time (EAT).`;
    } else if (prompt.includes('format with these exact markdown headers:') || prompt.includes('## key concepts')) {
      fullText = `# Operating Systems & Study Notes

## Key Concepts
- Process vs Thread execution model
- Concurrency and synchronization primitives
- Memory hierarchy and paging mechanics

## Important Definitions
- **Process:** An instance of a program in execution with its own address space.
- **Thread:** The smallest unit of execution within a process sharing the same address space.
- **Deadlock:** A state where a set of processes are blocked because each is holding a resource and waiting for another.

## Important Points
- Preemptive scheduling yields higher responsiveness compared to cooperative models.
- Virtual memory shields processes from corrupted memory states.

## Examples
- Mutex locks preventing race conditions in multithreaded bank transactions.

## Exam Tips
- Memorize the four Coffman conditions for deadlock: Mutual Exclusion, Hold and Wait, No Preemption, Circular Wait.

## Quick Revision
- Context switch overhead increases with smaller time quanta.
- Always check base cases when analyzing scheduling algorithms.`;
    } else if (prompt.includes('summarize') || prompt.includes('synthesize')) {
      fullText = `### Summary Overview

This document presents a rigorous exploration of core computer systems principles, memory management techniques, and system software execution pipelines.

#### Core Mechanics
The system utilizes stratified caching, paging, and demand loading to maximize throughput while minimizing I/O bottlenecks.

### Key Takeaways
- Memory abstractions decouple application architecture from hardware limits.
- Proper scheduling prevents starvation and minimizes latency.
- Localized indexing enables instantaneous retrieval without cloud dependencies.`;
    } else if (isBanglaOrBanglish && (prompt.includes('example') || prompt.includes('dao') || prompt.includes('daw') || prompt.includes('উদাহরণ') || prompt.includes('udahar')) && (priorContextText.includes('process') || prompt.includes('process'))) {
      fullText = `### Process (প্রসেস)-এর বাস্তব উদাহরণ:

একটি সহজ বাস্তব জীবনের উদাহরণ দিলে Process-এর ধারণা পুরোপুরি পরিষ্কার হবে:

মনে করুন, আপনার কম্পিউটারে **VLC Media Player** অথবা **Google Chrome** ইনস্টল করা আছে।
- যখন এটি বন্ধ অবস্থায় কম্পিউটারের হার্ডডিস্কে বা SSD-তে সেভ করা থাকে, তখন এটি কেবল একটি **Program** (নিষ্ক্রিয় কোড)।
- কিন্তু যখনই আপনি আইকনে ডাবল ক্লিক করে সেটি ওপেন করেন, অপারেটিং সিস্টেম তাৎক্ষণিকভাবে RAM-এ মেমরি অ্যালোকেট করে এবং CPU এর কোডগুলো রান করাতে শুরু করে—তখনই এটি পরিণত হয় একটি সক্রিয় **Process**-এ।

#### গুরুত্বপূর্ণ পয়েন্ট:
আপনি যদি একই সাথে দুটি আলাদা উইন্ডোতে দুটি গান চালান, তবে ব্যাকগ্রাউন্ডে একই VLC প্রোগ্রামের **দুটি সম্পূর্ণ স্বাধীন Process** তৈরি হবে এবং প্রত্যেকের আলাদা Process ID (PID) ও মেমরি স্পেস থাকবে।`;
    } else if (isBanglaOrBanglish && (prompt.includes('example') || prompt.includes('dao') || prompt.includes('daw') || prompt.includes('উদাহরণ') || prompt.includes('udahar')) && (priorContextText.includes('deadlock') || prompt.includes('deadlock'))) {
      fullText = `### Deadlock-এর বাস্তব উদাহরণ:

একটি সহজ ও ক্লাসিক বাস্তব উদাহরণ হলো **এক লেনের সংকীর্ণ ব্রিজ (Narrow Single-Lane Bridge)**:

- মনে করুন একটি ব্রিজে কেবল একটিমাত্র গাড়ি একবারে যেতে পারে।
- উত্তর দিক থেকে একটি গাড়ি ব্রিজের মাঝখানে এসে দাঁড়িয়ে গেল।
- দক্ষিণ দিক থেকেও আরেকটি গাড়ি ব্রিজের মাঝখানে এসে মুখোমুখি দাঁড়িয়ে গেল।

এখন কোনো চালকই গাড়ি পিছিয়ে নিতে প্রস্তুত নয় (**No Preemption**)। প্রত্যেকেই অপর পক্ষ সরে যাওয়ার অপেক্ষা করছে (**Hold and Wait**)। ফলে উভয় গাড়িই ব্রিজে চিরতরে আটকে গেল—এটাই হলো অপারেটিং সিস্টেমের **Deadlock**!`;
    } else if (isBanglaOrBanglish && (prompt.includes('5 ta mcq') || prompt.includes('5টি mcq') || prompt.includes('mcq daw') || prompt.includes('mcq বানাও') || (prompt.includes('mcq') && (prompt.includes('eta theke') || prompt.includes('এইটা থেকে') || prompt.includes('বানাও'))))) {
      const topicName = priorContextText.includes('deadlock') ? 'Deadlock' : priorContextText.includes('scheduling') ? 'Process Scheduling' : 'Operating System Process';
      fullText = `### ${topicName} থেকে ৫টি গুরুত্বপূর্ণ MCQ:

**১. একটি Process বলতে মূলত কী বোঝায়?**
- A) হার্ডডিস্কে সংরক্ষিত নিষ্ক্রিয় ফাইল
- B) Program in execution (চলমান প্রোগ্রাম) ✓
- C) শুধুমাত্র CPU রেজিস্টার
- D) মাদারবোর্ডের বায়োস কোড

**২. প্রতিটি Process-এর স্টেট ও মেমরি তথ্য কোথায় সংরক্ষিত থাকে?**
- A) Program Counter (PC)
- B) Process Control Block (PCB) ✓
- C) Virtual Bridge
- D) BIOS

**৩. Process Scheduling-এর মূল উদ্দেশ্য কী?**
- A) CPU-এর কার্যক্ষমতা ও Utilization সর্বোচ্চ রাখা ✓
- B) ইন্টারনেটের গতি বৃদ্ধি করা
- C) হার্ডডিস্ক ফরম্যাট করা
- D) গ্রাফিক্স কার্ড ওভারক্লক করা

**৪. কোন Scheduling অ্যালগরিদম Time Quantum ব্যবহার করে?**
- A) First-Come, First-Served (FCFS)
- B) Shortest Job First (SJF)
- C) Round Robin (RR) ✓
- D) Priority Non-preemptive

**৫. Deadlock সংগঠনের জন্য কয়টি Coffman Conditions একযোগে সত্য হতে হয়?**
- A) ১টি
- B) ২টি
- C) ৩টি
- D) ৪টি (Mutual Exclusion, Hold & Wait, No Preemption, Circular Wait) ✓`;
    } else if (prompt.includes('question 5') || prompt.includes('৫ নম্বর') || prompt.includes('prosno 5') || (prompt.includes('5') && (prompt.includes('explain') || prompt.includes('bujhao')))) {
      fullText = `### ৫ নম্বর প্রশ্নের বিস্তারিত ব্যাখ্যা:

**প্রশ্ন ৫ ছিল:** "Deadlock সংগঠনের জন্য কয়টি Coffman Conditions একযোগে সত্য হতে হয়?"

#### সঠিক উত্তর:
**৪টি শর্ত (Coffman Conditions)** সত্য হতে হয়।

#### সহজ ব্যাখ্যা:
অপারেটিং সিস্টেমে Deadlock সৃষ্টি হতে হলে **Mutual Exclusion**, **Hold and Wait**, **No Preemption**, এবং **Circular Wait**—এই ৪টি শর্তই একসাথে প্রযোজ্য হতে হবে। এর মধ্যে যেকোনো একটি শর্ত যদি আমরা ভেঙে দিতে পারি, তবে সিস্টেমে কখনো Deadlock ঘটবে না (Deadlock Prevention)।`;
    } else if (prompt.includes('hold and wait') || ((prompt.includes('2') || prompt.includes('২')) && (prompt.includes('number') || prompt.includes('নম্বর') || prompt.includes('condition')) && (priorContextText.includes('deadlock') || priorContextText.includes('condition') || prompt.includes('deadlock')))) {
      fullText = `### ২ নম্বর শর্ত: Hold and Wait (ধরে রেখে অপেক্ষা) সহজ ভাষায়:

**Hold and Wait** হলো ডেডলকের এমন একটি অবস্থা যেখানে একটি Process ইতিমধ্যে অন্তত একটি Resource নিজের দখলে রেখেছে এবং একই সাথে অন্য কোনো প্রসেসের দখলে থাকা আরেকটি Resource পাওয়ার জন্য অপেক্ষা করছে।

#### মূল বিষয়সমূহ:
১. **Hold:** প্রসেসটি নিজের রিসোর্সটি কাজ শেষ না হওয়া পর্যন্ত ছাড়বে না।
২. **Wait:** কাঙ্ক্ষিত নতুন রিসোর্স না পাওয়া পর্যন্ত প্রসেসটি কাজ শুরু বা শেষ করতে পারছে না।
৩. **ডেডলক সৃষ্টি:** এভাবে সবাই ধরে রেখে একে অন্যের জন্য অপেক্ষা করলে পুরো সিস্টেম স্থবির হয়ে যায়।`;
    } else if ((prompt.includes('example') || prompt.includes('udahar') || prompt.includes('উদাহরণ')) && (priorContextText.includes('hold and wait') || prompt.includes('hold and wait') || ((priorContextText.includes('deadlock') || prompt.includes('deadlock')) && !priorContextText.includes('round robin')))) {
      fullText = `### Hold and Wait-এর বাস্তব জীবনের উদাহরণ (Real-Life Example):

মনে করো ক্লাসে দুইজন শিক্ষার্থী—**সাকিব** ও **তামিম**। পরীক্ষার খাতায় গোল আঁকতে তাদের কম্পাস ও পেন্সিল উভয়ই প্রয়োজন।
- **সাকিব** কম্পাসটি নিজের হাতে নিয়ে রেখেছে (Hold), কিন্তু পেন্সিলের জন্য অপেক্ষা করছে (Wait)।
- **তামিম** পেন্সিলটি নিজের হাতে নিয়ে রেখেছে (Hold), কিন্তু কম্পাসের জন্য অপেক্ষা করছে (Wait)।

কেউই নিজের জিনিস ছাড়ছে না, আবার দুজনের কাজই আটকে আছে। কম্পিউটারে ঠিক একইভাবে যখন Process A স্ক্যানার ধরে রেখে প্রিন্টারের জন্য অপেক্ষা করে এবং Process B প্রিন্টার ধরে রেখে স্ক্যানারের জন্য অপেক্ষা করে, তখনই **Hold and Wait**-এর কারণে Deadlock হয়।`;
    } else if ((prompt.includes('mcq') || prompt.includes('quiz')) && (priorContextText.includes('deadlock') || priorContextText.includes('hold and wait') || prompt.includes('deadlock') || prompt.includes('hold and wait'))) {
      fullText = `### Deadlock ও Hold and Wait থেকে ৫টি গুরুত্বপূর্ণ MCQ:

**১. Deadlock সংগঠনের জন্য কয়টি Coffman Conditions একযোগে সত্য হতে হয়?**
- A) ১টি
- B) ২টি
- C) ৩টি
- D) ৪টি (Mutual Exclusion, Hold & Wait, No Preemption, Circular Wait) ✓

**২. Hold and Wait শর্তে প্রসেসগুলোর আচরণ কেমন থাকে?**
- A) রিসোর্স ছেড়ে দেয়
- B) একটি রিসোর্স নিজের দখলে রেখে অন্য রিসোর্সের অপেক্ষা করে ✓
- C) সাথে সাথে এক্সিকিউশন শেষ করে
- D) ক্যাশ মেমরি ক্লিয়ার করে

**৩. Deadlock Avoidance-এর জন্য কোন অ্যালগরিদমটি সর্বাধিক জনপ্রিয়?**
- A) Banker's Algorithm ✓
- B) FCFS
- C) Round Robin
- D) SJF

**৪. Circular Wait দূর করার কার্যকর উপায় কোনটি?**
- A) সমস্ত রিসোর্সের ওপর একটি Linear Ordering নির্ধারণ করা ✓
- B) মেমরি বন্ধ করে দেওয়া
- C) প্রসেস রিস্টার্ট না করা
- D) হার্ডডিস্ক বদলানো

**৫. No Preemption শর্তের অর্থ কী?**
- A) কোনো প্রসেসের কাছ থেকে জোরপূর্বক রিসোর্স কেড়ে নেওয়া যাবে না ✓
- B) সিস্টেম সবসময় প্রসেস বন্ধ করে দেয়
- C) সিপিইউ একাধিক কোর ব্যবহার করে
- D) মেমরি ওভারফ্লো রোধ করে`;
    } else if (prompt.includes('exam e ki vabe') || prompt.includes('exam e kivabe') || prompt.includes('পরীক্ষায়') || prompt.includes('পরীক্ষায়')) {
      fullText = `### পরীক্ষায় এই বিষয়ে পূর্ণ নম্বর পাওয়ার মতো লেখার কৌশল:

১. **স্পষ্ট সংজ্ঞা (Definition):** শুরুতেই ২-৩ লাইনে পরিচ্ছন্ন সংজ্ঞা দিন (যেমন: "OS হলো কম্পিউটার হার্ডওয়্যার ও ব্যবহারকারীর মধ্যবর্তী সিস্টেম সফটওয়্যার...)।
২. **মূল পয়েন্ট ও বুলেট (Key Architecture):** মূল কাজগুলোকে চার ভাগে ভাগ করে লিখুন:
   - Process Management
   - Memory Management
   - File System Management
   - I/O & Device Management
৩. **একটি সরল ডায়াগ্রাম (Block Diagram):** 
   \`[User] → [Applications] → [Operating System] → [Hardware]\`
৪. **বাস্তব উদাহরণ (Real-world OS):** Windows, Linux, Android-এর নাম উল্লেখ করুন।`;
    } else if (prompt.includes('ager answer') || prompt.includes('short koro') || prompt.includes('choto koro') || prompt.includes('আগের উত্তর') || prompt.includes('shorten')) {
      fullText = `### পূর্ববর্তী উত্তরের সংক্ষিপ্ত রূপ (Quick Summary):

- **মূল বিষয়:** প্রসেস একটি রিসোর্স নিজের দখলে রাখে এবং অপর রিসোর্সের জন্য অপেক্ষা করে।
- **সমস্যা:** একে অপরের জন্য অনির্দিষ্টকালের জন্য অপেক্ষা করায় সিস্টেমে অচলাবস্থা তৈরি হয়।
- **সমাধান:** কাজ শুরুর আগেই সমস্ত রিসোর্স একসাথে বরাদ্দ করা অথবা নতুন রিসোর্স চাওয়ার আগে বর্তমান রিসোর্স ছেড়ে দেওয়া।`;
    } else if (isBanglaOrBanglish && (prompt.includes('easy') || prompt.includes('shohoj') || prompt.includes('সহজ')) && (priorContextText.includes('condition') || priorContextText.includes('deadlock') || prompt.includes('condition') || prompt.includes('deadlock'))) {
      fullText = `### Deadlock-এর ৪টি শর্ত সহজ ভাষায়:

১. **Mutual Exclusion (একক ব্যবহার):** একটি রিসোর্স (যেমন প্রিন্টার) একবারে কেবল একজনই ব্যবহার করতে পারে।
২. **Hold and Wait (ধরে রেখে অপেক্ষা):** একটি রিসোর্স ধরে রেখে অন্য রিসোর্সের জন্য হাত বাড়িয়ে বসে থাকা।
৩. **No Preemption (কেড়ে নেওয়া যাবে না):** জোর করে কারো হাত থেকে রিসোর্স কেড়ে নেওয়া যাবে না; কাজ শেষে নিজ থেকেই ছাড়তে হবে।
৪. **Circular Wait (চক্রাকার অপেক্ষা):** প্রসেসগুলো গোল বৃত্তের মতো একজন আরেকজনের অপেক্ষায় গোল হয়ে বসে থাকা।`;
    } else if ((prompt.includes('mcq') || prompt.includes('quiz')) && (priorContextText.includes('chapter 2') || prompt.includes('chapter 2') || prompt.includes('chapter 02') || priorContextText.includes('chapter 02'))) {
      fullText = `### Chapter 2 থেকে ৫টি গুরুত্বপূর্ণ MCQ:

**১. কোনটি Operating System-এর একটি Core Architecture?**
- A) Monolithic Kernel ✓
- B) Simple Cable
- C) Audio Jack
- D) RAM Cache

**২. System Call-এর মাধ্যমে কোন মোডে ট্রানজিশন ঘটে?**
- A) User Mode থেকে Kernel Mode ✓
- B) Sleep Mode থেকে Hibernate
- C) GPU Mode থেকে CPU
- D) BIOS থেকে Monitor

**৩. fork() সিস্টেম কলের কাজ কী?**
- A) নতুন চাইল্ড প্রসেস তৈরি করা ✓
- B) কম্পিউটার শাটডাউন করা
- C) ফাইল ডিলিট করা
- D) সাউন্ড বাড়ানো

**৪. Microkernel আর্কিটেকচারের সুবিধা কী?**
- A) মডুলারিটি ও রিলায়েবিলিটি বৃদ্ধি পায় ✓
- B) কোড সাইজ আনলিমিটেড হয়
- C) রিস্টার্ট লাগে না
- D) হার্ডডিস্ক দরকার হয় না

**৫. CLI-এর পূর্ণরূপ কী?**
- A) Command Line Interface ✓
- B) Central Log Index
- C) Core Language Input
- D) Common Line Instruction`;
    } else if ((prompt.includes('exam') || prompt.includes('aste pare') || prompt.includes('porikkha')) && (priorContextText.includes('pdf') || priorContextText.includes('topic') || prompt.includes('pdf') || prompt.includes('topic') || sys.includes('attached documents'))) {
      fullText = `### এই PDF থেকে পরীক্ষায় আসার মতো গুরুত্বপূর্ণ বিষয়সমূহ (Exam Topics):

১. **Deadlock ও Coffman-এর ৪টি শর্ত** (১০ নম্বরের ব্রড প্রশ্ন হিসেবে প্রায়ই আসে)।
২. **Process Scheduling অ্যালগরিদম** (Round Robin vs SJF-এর পার্থক্য ও Gantt Chart অঙ্কন)।
৩. **Virtual Memory ও Paging-এর ধারণা** (Page fault এবং TLB-এর গুরুত্ব)।
৪. **System Calls (fork(), exec())-এর কার্যপদ্ধতি**।`;
    } else if (isBanglaOrBanglish && (prompt.includes('process scheduling') || (prompt.includes('scheduling') && prompt.includes('process')))) {
      fullText = `### Process Scheduling (প্রসেস শিডিউলিং) সহজ ভাষায়:

অপারেটিং সিস্টেমে যখন একাধিক Process একসাথে চলতে চায়, তখন CPU কোন প্রসেসটিকে আগে সময় দেবে এবং কতক্ষণ চালাবে—সেই সিদ্ধান্ত নেওয়ার প্রক্রিয়াকে **Process Scheduling** বলে। 

CPU যাতে এক মুহূর্তও অলস বসে না থাকে এবং সবগুলো অ্যাপ্লিকেশন সমান সুযোগ পায়, তা নিশ্চিত করাই এর প্রধান কাজ।

#### প্রধান Scheduling অ্যালগরিদমসমূহ:
1. **First-Come, First-Served (FCFS):** যে প্রসেসটি আগে লাইনে আসবে, CPU তাকেই আগে সার্ভিস দেবে (সাধারণ ব্যাংকের লাইনের মতো)।
2. **Shortest Job First (SJF):** যে প্রসেসটির রান হতে সবচেয়ে কম সময় লাগবে, সেটি আগে সুযোগ পাবে।
3. **Round Robin (RR):** প্রতিটি প্রসেসকে একটি নির্দিষ্ট সময়সীমা বা **Time Quantum** (যেমন ১০ মিলিসেকেন্ড) দেওয়া হয়। সময় শেষ হলে পরবর্তী প্রসেসে সুইচ করে।
4. **Priority Scheduling:** অধিক গুরুত্বপূর্ণ বা উচ্চ অগ্রাধিকারের প্রসেস আগে রান করবে।`;
    } else if (isBanglaOrBanglish && (prompt.includes('process') || prompt.includes('প্রসেস') || prompt.includes('ki bujhay') || prompt.includes('বলতে কি'))) {
      fullText = `### Operating System-এ Process (প্রসেস) কী?

সহজ বাংলায়, একটি **Process** হলো একটি প্রোগ্রাম যা বর্তমানে মেমরিতে (RAM) সক্রিয়ভাবে রান বা এক্সিকিউট করছে (**Program in execution**)।

একটি প্রোগ্রাম যখন কম্পিউটারের হার্ডডিস্কে সেভ করা থাকে, তখন সেটি একটি নিষ্ক্রিয় কোড। কিন্তু যখনই অপারেটিং সিস্টেম তাকে মেমরিতে লোড করে এবং CPU তাকে রান করাতে শুরু করে, তখনই সেটি সক্রিয় **Process** হয়।

#### একটি Process-এর প্রধান উপাদানসমূহ:
1. **Text Section:** প্রসেসটির মূল মেশিন কোড।
2. **Stack:** ফাংশন প্যারামিটার, লোকাল ভেরিয়েবল এবং রিটার্ন অ্যাড্রেস।
3. **Data Section:** গ্লোবাল ও স্ট্যাটিক ভেরিয়েবল।
4. **Heap:** রানটাইমে ডায়নামিকালি মেমরি অ্যালোকশনের জন্য স্পেস।
5. **PCB (Process Control Block):** প্রতিটি প্রসেসের স্টেট, PID ও CPU রেজিস্টারের তথ্য ধারণকারী ব্লক।`;
    } else if (isBanglaOrBanglish && prompt.includes('deadlock')) {
      fullText = `### Operating System-এ Deadlock কী?

**Deadlock** হলো এমন একটি অচলাবস্থা যেখানে দুই বা ততোধিক Process একে অপরের ব্যবহৃত রিসোর্সের জন্য অনির্দিষ্টকালের জন্য অপেক্ষা করতে থাকে, ফলে পুরো সিস্টেম স্থবির হয়ে পড়ে।

#### Deadlock সৃষ্টির ৪টি শর্ত (Coffman Conditions):
1. **Mutual Exclusion:** রিসোর্সটি একাধিক প্রসেস একসাথে শেয়ার করতে পারে না।
2. **Hold and Wait:** একটি প্রসেস একটি রিসোর্স ধরে রেখে অন্য প্রসেসের রিসোর্সের জন্য অপেক্ষা করে।
3. **No Preemption:** জোরপূর্বক কোনো প্রসেসের কাছ থেকে রিসোর্স কেড়ে নেওয়া যায় না।
4. **Circular Wait:** প্রসেসগুলোর মধ্যে একটি চক্রাকার অপেক্ষার সৃষ্টি হয়।`;
    } else if (prompt.includes('deadlock')) {
      fullText = `### Deadlock in Operating Systems

A **deadlock** is a state in concurrent systems where a set of processes are permanently blocked because each process is holding a resource and waiting to acquire a resource held by another process in the set.

#### The Four Coffman Conditions:
1. **Mutual Exclusion:** At least one resource must be held in a non-shareable mode.
2. **Hold and Wait:** A process must currently hold at least one resource and be waiting to acquire additional resources held by other processes.
3. **No Preemption:** Resources cannot be confiscated forcibly; they can only be released voluntarily by the process holding them.
4. **Circular Wait:** A closed chain of processes exists such that each process holds one or more resources needed by the next process in the chain.

#### Handling Deadlocks:
- **Prevention:** Design the system to ensure at least one of the Coffman conditions can never hold.
- **Avoidance (Banker's Algorithm):** Dynamically examine resource allocation state to ensure a circular wait condition can never exist.
- **Detection & Recovery:** Periodically inspect system resource allocation graphs to find cycles, then abort processes or preempt resources.`;
    } else if (prompt.includes('round robin')) {
      fullText = `### Round Robin Scheduling

**Round Robin (RR) scheduling** assigns CPU execution time to each process in the ready queue using a fixed **time quantum** in circular order.

#### Key Mechanics:
- **Preemptive:** If a process does not complete within its assigned time quantum, it is preempted and moved to the back of the ready queue.
- **Starvation-Free:** Every process receives guaranteed CPU cycles without priority starvation.
- **Quantum Selection:** A balanced time quantum prevents excessive context switching while maintaining responsiveness.

If you asked to explain this in easy terms (সহজ ভাষায়):
মনে করো ৩ জন বন্ধু একটা কম্পিউটার গেম খেলার জন্য লাইনে দাঁড়িয়ে আছে। তুমি সবাইকে ১০ মিনিট করে সময় দিলে (এটাকে Time Quantum বলে)। যার খেলা শেষ হবে না, সে আবার লাইনের পেছনে গিয়ে দাঁড়াবে। এভাবে সবাই সমান সুযোগ পায় এবং কেউ না খেলে আটকে থাকে না।`;
    } else if (prompt.includes('chapter 02') || prompt.includes('chapter 2') || prompt.includes('অধ্যায়') || (prompt.includes('theke') && prompt.includes('bujhao'))) {
      fullText = `### Chapter 02: Operating System Structures & Core Architecture

Based on your local study materials for Chapter 02:

#### 1. Operating System Services
The OS provides an environment for program execution and essential services:
- **User Interface:** CLI (Command Line Interface), GUI (Graphical User Interface), and batch interfaces.
- **Program Execution:** Loading programs into memory, running them, and handling termination.
- **I/O Operations:** Managing input/output devices safely and efficiently.
- **File-System Manipulation:** Creating, reading, writing, and deleting files and directories.
- **Communication & Resource Allocation:** IPC (Inter-Process Communication) and multi-user resource sharing.

#### 2. System Calls
System calls are the programmatic way in which a computer program requests a service from the kernel of the operating system:
- Examples: \`fork()\`, \`exec()\`, \`read()\`, \`write()\`, \`open()\`, \`close()\`.
- Invoked via software interrupts or traps switching from User Mode (Ring 3) to Kernel Mode (Ring 0).

#### 3. Kernel Architectures
- **Monolithic Kernels:** All OS services run in kernel space (high speed, Unix/Linux design).
- **Microkernels:** Only minimal core functions in kernel; file systems and device drivers run in user space (reliable, modular).`;
    } else if (prompt.includes('local study material:')) {
      fullText = `### Study Material Explanation & Synthesis

Based on your retrieved study document:

#### Core Insights:
- The material outlines foundational operating systems and computing principles.
- Concurrency, CPU time distribution, and isolated memory spaces protect applications from system-level crashes.
- Direct hardware abstraction enables secure multi-tasking across heterogeneous processor architectures.

Feel free to ask specific questions about any section, algorithm, or chapter in your notes!`;
    } else if (prompt.includes('operating system') || prompt.includes('os')) {
      fullText = `### Operating System Concepts

An **Operating System (OS)** is system software that manages computer hardware, software resources, and provides common services for computer programs.

#### Key Functions of an OS:
1. **Process Management:** CPU scheduling, creation, and termination of processes.
2. **Memory Management:** Allocating and deallocating memory space (RAM).
3. **File System Management:** Managing files, directories, and access permissions.
4. **Device Management:** Device drivers and I/O hardware control.

\`\`\`c
// Example: Basic C process creation using fork()
#include <stdio.h>
#include <unistd.h>

int main() {
    pid_t pid = fork();
    if (pid == 0) {
        printf("Hello from Child Process! PID: %d\\n", getpid());
    } else {
        printf("Hello from Parent Process! PID: %d\\n", getpid());
    }
    return 0;
}
\`\`\`

*Offline Study AI: Running in Mock Assistant mode. When a local GGUF model is selected, responses will stream from llama.cpp.*`;
    } else if (prompt.includes('data structure') || prompt.includes('array') || prompt.includes('list') || prompt.includes('binary search')) {
      fullText = `### Binary Search Algorithm

**Binary Search** is an efficient algorithm for finding an element in a **sorted array**. It operates on a divide-and-conquer strategy with a time complexity of **O(log n)**.

#### Python Implementation:

\`\`\`python
def binary_search(arr, target):
    left, right = 0, len(arr) - 1
    
    while left <= right:
        mid = (left + right) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
            
    return -1

# Example usage
numbers = [2, 5, 8, 12, 16, 23, 38, 56, 72, 91]
index = binary_search(numbers, 23)
print(f"Element found at index: {index}")
\`\`\`

#### Complexity Summary:
- **Best Case:** O(1)
- **Average/Worst Case:** O(log n)
- **Space Complexity:** O(1) iterative`;
    } else if (prompt.includes('simpler') || prompt.includes('simple words') || prompt.includes('eli5')) {
      fullText = `### In Very Simple Words:

Think of a computer like a busy restaurant:
- **The Hardware (CPU, RAM, Hard Drive):** This is the kitchen, the cooking pans, and the refrigerator.
- **The Programs (Apps, Games, Browser):** These are the customers ordering different dishes.
- **The Operating System:** This is the **head chef/manager**. It decides who gets the cooking pan first, makes sure one order doesn't burn down the kitchen, and keeps everything organized so the food gets delivered smoothly!`;
    } else if (prompt.includes('hello') || prompt.includes('hi') || prompt.includes('hey')) {
      fullText = `Hello! I am your **Offline Study Assistant**. 

I am here to help you study, review notes, summarize concepts, and solve technical problems completely offline. 

How can I assist your study session today?`;
    } else if (isBanglaOrBanglish) {
      fullText = `### পড়ালেখার নোট ও পর্যালোচনা:

আপনার প্রশ্ন: "${lastUserMsg?.content || ''}"।

এখানে বিষয়টি সহজে বুঝার জন্য মূল পয়েন্টগুলো তুলে ধরা হলো:

#### গুরুত্বপূর্ণ বিষয়সমূহ:
- **মূল ধারণা (Core Concept):** জটিল বিষয়গুলোকে ছোট ছোট সহজ অংশে ভাগ করে বুঝুন।
- **বাস্তব প্রয়োগ (Application):** বাস্তব উদাহরণ ও কোড দেখে চর্চা করলে সহজে মনে থাকে।
- **পুনরাবৃত্তি (Active Recall):** পড়ার পর নিজে নিজে প্রশ্ন তৈরি করে বা Flashcard দিয়ে রিভিশন দিন।

আপনার যদি এই বিষয়ে নির্দিষ্ট কোনো উদাহরণ, কোড বা MCQ প্রয়োজন হয়, তবে নিঃসংকোচে বলুন!`;
    } else {
      fullText = `### Study Notes: Explanation & Review

Thank you for your question: "${lastUserMsg?.content || ''}".

Here is a structured study breakdown:

#### Key Concepts to Remember:
- **Core Definition:** Break down complex topics into smaller foundational principles.
- **Application:** Practice implementing solutions with real-world examples.
- **Review:** Test yourself periodically using active recall and flashcards.

\`\`\`javascript
// Example Code Snippet
function studySession(topic) {
  console.log("Analyzing topic: " + topic);
  return { status: "Understood", activeRecall: true };
}
\`\`\`

Feel free to ask follow-up questions or request code examples, practice questions, or flashcards!`;
    }

    // Check cancellation before streaming
    if (options?.signal?.aborted) {
      throw new Error('Inference was cancelled by user.');
    }

    // If streaming callback is requested, stream chunks
    if (options?.callbacks?.onToken) {
      const words = fullText.split(' ');
      for (let i = 0; i < words.length; i++) {
        if (options?.signal?.aborted) {
          throw new Error('Inference was cancelled by user.');
        }
        const chunk = (i === 0 ? '' : ' ') + words[i];
        options.callbacks.onToken(chunk);

        // Micro delay if signal is active or in browser environment
        if (options?.signal || typeof window !== 'undefined') {
          await new Promise((resolve) => setTimeout(resolve, 8));
        }
      }
    } else if (typeof window !== 'undefined') {
      // Non-streaming simulated delay in browser only
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    const endTime = performance.now();
    const totalDurationMs = Math.max(1, Math.round(endTime - startTime));
    const tokenCount = Math.ceil(fullText.length / 3.5);
    const tokensPerSecond = parseFloat(((tokenCount / totalDurationMs) * 1000).toFixed(1));

    const metrics: GenerationMetrics = {
      providerId: 'mock',
      providerName: 'Mock AI',
      modelName: 'Offline Fallback',
      totalDurationMs,
      tokenCount,
      tokensPerSecond
    };

    options?.callbacks?.onComplete?.(fullText, metrics);
    return fullText;
  }
}
