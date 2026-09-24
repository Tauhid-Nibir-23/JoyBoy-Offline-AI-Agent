import { AIProvider, ChatMessage, GenerateOptions, GenerationMetrics } from './provider';

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

    let fullText = '';

    const sys = options?.systemPrompt?.toLowerCase() || '';

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
    } else if (prompt.includes('round robin') || prompt.includes('local study material:')) {
      fullText = `### Round Robin Scheduling (from Local Study Material)

Based on your local study materials:
**Round Robin (RR) scheduling** assigns CPU execution time to each process in the ready queue using a fixed **time quantum** in circular order.

#### Key Mechanics:
- **Preemptive:** If a process does not complete within its assigned time quantum, it is preempted and moved to the back of the ready queue.
- **Starvation-Free:** Every process receives guaranteed CPU cycles without priority starvation.
- **Quantum Selection:** A balanced time quantum prevents excessive context switching while maintaining responsiveness.`;
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
