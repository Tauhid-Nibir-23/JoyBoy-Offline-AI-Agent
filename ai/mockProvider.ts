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

    if (prompt.includes('round robin') || prompt.includes('local study material:')) {
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
