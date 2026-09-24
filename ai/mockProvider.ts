import { AIProvider, ChatMessage } from './provider';

export class MockAIProvider implements AIProvider {
  public name = 'Mock Study Assistant';

  public async generateResponse(history: ChatMessage[]): Promise<string> {
    // Artificial 600ms delay to simulate local processing & loading state
    await new Promise((resolve) => setTimeout(resolve, 600));

    const lastUserMsg = [...history].reverse().find((m) => m.role === 'user');
    const prompt = lastUserMsg ? lastUserMsg.content.trim().toLowerCase() : '';

    if (prompt.includes('operating system') || prompt.includes('os')) {
      return `### Operating System Concepts

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

*Note: In Phase 2, this response will be powered directly by your local llama.cpp GGUF model!*`;
    }

    if (prompt.includes('data structure') || prompt.includes('array') || prompt.includes('list') || prompt.includes('binary search')) {
      return `### Binary Search Algorithm

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
    }

    if (prompt.includes('hello') || prompt.includes('hi') || prompt.includes('hey')) {
      return `Hello! I am your **Offline Study Assistant**. 

I am here to help you study, review notes, summarize concepts, and solve technical problems completely offline. 

How can I assist your study session today?`;
    }

    // Default informative response
    return `### Study Notes: Explanation & Review

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
}
