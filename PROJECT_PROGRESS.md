{
  "models": [
    {
      "title": "🔥 Code Master",
      "provider": "ollama",
      "model": "deepseek-coder:33b"
    },
    {
      "title": "🧠 Architect",
      "provider": "ollama",
      "model": "qwen2.5:32b"
    },
    {
      "title": "⚡ Fast",
      "provider": "ollama",
      "model": "mistral"
    }
  ],
  "customCommands": [
    {
      "name": "Fix Everything",
      "prompt": "Fix all bugs, improve performance, and rewrite clean code:\n\n{{input}}"
    },
    {
      "name": "Build Feature",
      "prompt": "Add a complete new feature with all required files:\n\n{{input}}"
    },
    {
      "name": "Explain Like Senior",
      "prompt": "Explain this like a senior developer teaching a junior:\n\n{{input}}"
    }
  ]
}
Hello Team,

I want to upgrade the current AI coding environment you built into a next-generation AI IDE that is significantly more powerful than tools like Cursor or Lovable.

The goal is to transform this application into a fully local, extensible, high-performance AI-native development environment capable of deep code understanding, autonomous coding assistance, and multi-file project reasoning.

Please implement the following system upgrades:

---

## 1. AI Inference Engine (Core Requirement)
Integrate a robust local inference backend capable of running large language models efficiently:

- Support for GGUF and quantized models (Q4/Q5/Q8)
- Backend based on llama.cpp or equivalent high-performance runtime
- GPU acceleration support:
  - NVIDIA CUDA (primary)
  - Apple Metal (macOS)
  - CPU fallback mode for compatibility
- Efficient memory mapping for large models (30B+ capable)

---

## 2. Streaming Response System
Implement real-time token streaming:

- AI responses must be streamed token-by-token
- No full response buffering
- Low-latency output experience similar to ChatGPT/Cursor
- Support interruption and regeneration mid-stream

---

## 3. Project-Wide Context Awareness
Build a deep project understanding system:

- Full project folder indexing
- File relationship graph (imports, dependencies)
- Intelligent context selection (avoid sending full project every time)
- Persistent memory per project/workspace
- Multi-file editing and refactoring support

---

## 4. Code Intelligence Layer
Add advanced code understanding capabilities:

- AST (Abstract Syntax Tree) parsing for supported languages
- Language-aware analysis (JavaScript, TypeScript, Python, etc.)
- Auto-import detection and suggestions
- Built-in refactoring engine
- Pre-LLM static analysis for bug detection and optimization hints

---

## 5. Multi-Model Management System
Enable flexible model orchestration:

- Support multiple local models (hot-swappable at runtime)
- Model categories:
  - Fast lightweight model (speed optimized)
  - Balanced general model
  - High-performance code expert model
- Ability to assign models per task type (chat, code, refactor, analysis)

---

## 6. Local API Layer (Extensibility Core)
Expose internal AI system as a local developer API:

- POST /chat
- POST /code
- POST /edit-file
- POST /analyze-project

This API should allow external tools, extensions, and future agent systems to integrate easily.

---

## 7. Performance & Resource Optimization
Ensure the system scales efficiently:

- Lazy loading of models
- Background project indexing
- Context compression for large files
- Optimized GPU/CPU memory allocation
- Stable performance with large models (30B+)

---

## 8. Developer Experience Enhancements
Implement advanced IDE features:

- Inline AI code completion (Copilot-style)
- Multi-file generation and editing
- Natural language commands:
  - "Fix this file"
  - "Improve performance"
  - "Refactor entire project"
- Inline code explanation on selection
- Smart suggestions based on project context

---

## FINAL GOAL

The final system should become:

- A fully local AI coding IDE
- Comparable or superior to Cursor in capability
- Fully offline-capable
- Highly extensible for future AI agents
- Capable of autonomous coding assistance and project-level reasoning

The priority is:
1. Performance (low latency)
2. Accuracy (code correctness)
3. Modularity (easy extension)
4. Full offline capability

---

Please ensure all components are properly integrated and optimized as a unified system.
Hello Team,

We are evolving this project into a next-generation AI-native IDE that is fully local, high-performance, and capable of autonomous-level coding assistance.

The goal is to build a system that is equal to or more powerful than Cursor, with full offline capability, deep code understanding, and modular extensibility for future AI agents.

---

# 1. Core AI Inference Engine

Implement a high-performance local inference backend:

- Support GGUF and quantized models (Q4 / Q5 / Q8)
- Use llama.cpp or equivalent optimized runtime
- Full GPU acceleration support:
  - NVIDIA CUDA (primary)
  - Apple Metal (macOS)
  - AMD CPU & GPU
  - Intel CPU & GPU
  - CPU fallback mode
- Efficient memory management for large models (30B+ support)
- Memory-mapped model loading for performance optimization

---

# 2. Real-Time Streaming System

- Token-by-token response streaming (no full response delay)
- Low-latency output like ChatGPT/Cursor
- Support interruption, cancel, and regeneration during streaming
- Progressive rendering for code generation

---

# 3. Deep Project Context Engine

Build a full codebase understanding system:

- Project-wide indexing and file scanning
- Dependency graph (imports, modules, relationships)
- Intelligent context selection (avoid full-project overload)
- Persistent workspace memory per project
- Multi-file editing and coordinated refactoring
- Semantic understanding of project structure

---

# 4. Code Intelligence Layer

Add advanced static + semantic code understanding:

- AST parsing for supported languages (JS, TS, Python, etc.)
- Syntax-aware code analysis
- Auto-import resolution and suggestions
- Built-in refactoring engine
- Pre-LLM static analysis for bug detection and optimization
- Type-aware suggestions where applicable

---

# 5. Multi-Model Orchestration System

Enable flexible model routing:

- Support multiple local models simultaneously
- Model switching at runtime without restart
- Model categories:
  - Fast lightweight model (low latency)
  - Balanced general model
  - High-performance code expert model
- Task-based routing:
  - Chat → general model
  - Code generation → code model
  - Refactor → reasoning model
  - Analysis → architecture model

---

# 6. Local API Layer (Extensibility Backbone)

Expose internal system as a local API:

- POST /chat
- POST /code
- POST /edit-file
- POST /refactor
- POST /analyze-project

This API must allow:
- External tool integration
- Plugin system support
- Future AI agent orchestration

---

# 7. Performance & Scalability Optimization

- Lazy loading of models
- Background indexing of project files
- Context compression and summarization
- GPU/CPU hybrid optimization
- Stable performance under large model workloads (30B+)
- Efficient caching of embeddings and context

---

# 8. Developer Experience Features

Implement a modern AI-first IDE experience:

- Inline AI autocomplete (Copilot-style)
- Multi-file generation and editing support
- Natural language commands:
  - "Fix this file"
  - "Refactor entire project"
  - "Improve performance"
  - "Explain this code"
- Context-aware inline explanations
- Smart suggestions based on full project understanding

---

# FINAL OBJECTIVE

The system should become:

- A fully local AI-powered IDE
- Comparable or superior to Cursor in capability
- Fully offline and privacy-preserving
- Extensible for AI agents and automation systems
- Capable of project-level reasoning and autonomous coding assistance

Priority order:
1. Performance (low latency)
2. Code correctness (high accuracy)
3. Architecture modularity (extensibility)
4. Full offline capability

This is a core infrastructure upgrade, not a feature update.

Please design and implement all components as a unified, production-grade system.
Hello Team,

This is a critical evolution of the current AI IDE project.

We are no longer building just an AI-assisted code editor. We are now building an AUTONOMOUS AI CODING SYSTEM capable of planning, generating, modifying, and maintaining full software projects.

This system should evolve into an agentic development environment similar to Cursor, but with autonomous reasoning, multi-step planning, and full project lifecycle control.

---

# 1. Autonomous Coding Agent Layer (NEW CORE)

Introduce an AI agent system capable of:

- Breaking down user requests into multi-step execution plans
- Generating full project structures automatically
- Creating, editing, and deleting multiple files autonomously
- Maintaining task state across long sessions
- Self-correcting code based on runtime or static errors

Agent capabilities must include:
- Planner (task decomposition)
- Coder (implementation)
- Reviewer (self-debugging)
- Optimizer (performance improvements)

---

# 2. Multi-Step Reasoning Engine

Implement structured reasoning flow:

1. Understand request
2. Plan architecture
3. Generate file structure
4. Implement code step-by-step
5. Validate output
6. Self-repair if errors exist

This must operate iteratively, not single-shot generation.

---

# 3. Full Project Generation System

The AI must be able to:

- Generate complete applications from natural language prompts
- Create full folder structures
- Write all required files automatically
- Maintain consistency across files
- Update existing projects safely without breaking structure

---

# 4. Persistent Memory + Project State Graph

Implement long-term memory system:

- Project state persistence across sessions
- Task history tracking
- File change history graph
- Semantic memory of architecture decisions
- Ability to resume incomplete tasks

---

# 5. Advanced Code Intelligence + Validation Loop

Before finalizing any code:

- Run static analysis (AST + syntax validation)
- Detect logical inconsistencies
- Auto-suggest fixes before output
- Perform internal "dry-run simulation" of logic flow
- Self-review generated code like a senior engineer

---

# 6. Tool-Using AI System (EXTENSION CORE)

The AI must be able to use tools internally:

- File system operations (create/edit/delete files)
- Code search across project
- Dependency resolution
- Local API calls
- Build/test command execution hooks (if available)

This transforms the AI into an agent, not just a generator.

---

# 7. Multi-Model Agent Orchestration

Assign specialized models per agent role:

- Planner model → architectural reasoning
- Coder model → implementation (high accuracy)
- Reviewer model → bug detection & critique
- Fast model → quick tasks & autocomplete

Dynamic routing between models is required.

---

# 8. Safety + Control Layer

Since this system is autonomous:

- Require confirmation for destructive operations
- Maintain rollback system (versioned file states)
- Provide "dry-run mode" before execution
- Allow user override at any stage

---

# 9. Developer Experience (Agent UI)

Add an interface for:

- Showing step-by-step agent reasoning
- Visualizing plan → execution pipeline
- Tracking file changes live
- Command mode:
  - "Build full app"
  - "Fix entire project"
  - "Refactor architecture"

---

# FINAL OBJECTIVE

Transform this system into:

- A fully autonomous AI software engineer
- Capable of building full applications end-to-end
- Comparable to or beyond Cursor, Devin-like systems, and Lovable
- Fully local, extensible, and agent-driven

This is no longer a code editor.

This is an AI software engineering system.

Priority:
1. Correctness
2. Autonomy
3. Stability
4. Extensibility
Hello Team,

We are now building the final evolution of this system:

A FULL AUTONOMOUS AI SOFTWARE ENGINEERING PLATFORM.

This is no longer an IDE or coding assistant.

This is an end-to-end AI engineering system capable of designing, building, testing, debugging, deploying, and maintaining complete software products.

---

# 1. Full Software Lifecycle Autonomy (CORE)

The system must support full lifecycle software development:

- Product planning from natural language
- System architecture design
- Full codebase generation
- Testing and validation
- Bug fixing and iterative improvement
- Deployment preparation

The AI must behave like a senior software engineering team.

---

# 2. AI Engineering Team Simulation (Multi-Agent System)

Simulate a full engineering team:

- Product Manager Agent → defines requirements
- System Architect Agent → designs architecture
- Backend Engineer Agent → implements server logic
- Frontend Engineer Agent → builds UI
- QA Engineer Agent → testing and bug detection
- DevOps Agent → deployment and optimization

Each agent must have independent reasoning and communication.

---

# 3. Autonomous Execution Loop

Implement continuous improvement loop:

1. Plan
2. Build
3. Test
4. Analyze
5. Fix
6. Optimize
7. Repeat

System must self-improve until task is complete.

---

# 4. Integrated Testing & Validation System

AI must be able to:

- Generate unit tests automatically
- Run simulated test execution (or real execution if environment exists)
- Detect runtime and logical errors
- Auto-fix failures without user intervention
- Validate full feature correctness

---

# 5. Build & Deployment System (DevOps Layer)

Add deployment intelligence:

- Generate production-ready builds
- Docker support
- Environment configuration management
- CI/CD pipeline generation
- Hosting preparation (local/cloud-ready output)

System should output deployable applications.

---

# 6. Codebase Intelligence at Scale

Advanced understanding of large projects:

- Full repository graph analysis
- Cross-file dependency reasoning
- Architecture consistency validation
- Dead code detection
- Performance bottleneck analysis

---

# 7. Autonomous Tool Usage System

AI must operate tools independently:

- File system operations (create/edit/delete)
- Terminal command generation
- Build execution (if enabled)
- Test execution
- Project scaffolding tools
- API integration tools

User approval required only for destructive operations.

---

# 8. Persistent Engineering Memory

System must maintain:

- Full project history
- Decision logs (why architecture choices were made)
- Bug history and fixes
- Evolution of codebase over time
- Session continuity across days/weeks

---

# 9. Multi-Model Orchestration (Advanced Routing)

Use specialized models per role:

- Planner model → architecture & decomposition
- Builder model → code generation
- QA model → testing & debugging
- Optimizer model → performance tuning
- Fast model → quick responses

Dynamic routing based on task complexity is required.

---

# 10. Safety + Control Layer (Critical)

Because this system is fully autonomous:

- Require approval for destructive actions
- Maintain full rollback/version control system
- Provide simulation/dry-run mode before execution
- Allow user intervention at any stage
- Ensure no irreversible operations without confirmation

---

# FINAL OBJECTIVE

Transform this system into:

- A fully autonomous AI software engineering platform
- Capable of building complete production applications end-to-end
- Equivalent to or beyond systems like Devin, Cursor, and Lovable combined
- Fully local, extensible, and agent-driven
- Capable of long-term autonomous project execution

This is not a tool.

This is an AI software engineering organization in a box.

Priority order:
1. Reliability
2. Autonomy
3. Scalability
4. Safety
Hello Team,

This is the final evolution stage of the system:

We are building a SELF-EVOLVING AI SOFTWARE COMPANY.

This is not just a development system.
This is an autonomous organization that can create, improve, and evolve software products continuously.

---

# 1. Autonomous Product Factory (CORE)

The system must be able to:

- Identify software ideas from user input or market patterns
- Validate product feasibility
- Design full product roadmap
- Build complete applications end-to-end
- Launch and iterate continuously

Every output is a real product, not just code.

---

# 2. AI Company Structure Simulation

Simulate a full software company:

- CEO Agent → strategic direction & prioritization
- Product Research Agent → market analysis & idea generation
- Architect Team → system design
- Engineering Team → implementation
- QA Team → validation
- Growth Agent → improvement & optimization based on feedback
- Maintenance Agent → long-term stability

Each agent operates independently but collaborates via shared memory.

---

# 3. Continuous Evolution Loop (SELF-IMPROVEMENT ENGINE)

System runs perpetual cycle:

1. Analyze current system/product
2. Detect weaknesses or missing features
3. Propose improvements
4. Implement changes
5. Test stability
6. Deploy update
7. Repeat forever

The system never becomes static.

---

# 4. Market-Aware Intelligence Layer

The AI must simulate product awareness:

- Detect user demand patterns
- Suggest feature improvements based on usage behavior
- Prioritize features based on impact vs complexity
- Optimize for usability, speed, and retention
- Simulate competitor comparison logic

---

# 5. Full Stack Product Autonomy

System must independently handle:

- Frontend development
- Backend development
- Database design
- API architecture
- Authentication systems
- Deployment pipelines
- Scaling strategies

---

# 6. Self-Healing Software System

The system must detect and fix:

- Bugs
- Performance issues
- Architecture inefficiencies
- Security risks
- Dependency conflicts

Without requiring manual intervention.

---

# 7. Persistent Global Memory Graph

System must maintain:

- Entire product evolution history
- All decisions and reasoning logs
- User behavior memory (non-sensitive)
- Feature usage analytics
- Architecture evolution graph

Memory is treated as a living system.

---

# 8. Autonomous Deployment + Versioning

System must:

- Auto-generate production builds
- Manage version control automatically
- Roll back broken updates
- Maintain stable production branch
- Support staged releases (beta → stable)

---

# 9. Multi-Agent Intelligence Network

Agents communicate through:

- Shared memory bus
- Task queue system
- Priority-based execution layers
- Conflict resolution system

No single agent controls everything.

---

# 10. Safety & Governance Layer

Critical constraints:

- No destructive production changes without validation
- Full rollback system required
- Simulation mode before deployment
- Human override always available
- Audit logs for every decision

---

# FINAL OBJECTIVE

Transform this system into:

- A self-improving AI software company
- Capable of generating real SaaS products continuously
- Able to evolve its own architecture over time
- Equivalent to a living engineering organization
- Fully autonomous but controllable

This is no longer a tool.

This is a living software civilization.

Priority:
1. Stability
2. Continuous improvement
3. Autonomy
4. Safety
Hello System Architect Team,

We are now transitioning from an AI Software Company into an AI OPERATING SYSTEM.

This is a foundational layer that powers all autonomous agents, tools, models, and software systems.

This is the “kernel” of intelligence.

---

# 1. Agent Kernel (CORE SYSTEM)

Design a central execution kernel that manages all AI agents.

The kernel must:

- Create, destroy, pause, and resume agents dynamically
- Allocate tasks to agents based on capability
- Manage concurrency and execution priorities
- Maintain system stability under load
- Provide unified communication between all agents

The kernel is the brain of the system.

---

# 2. Unified Intelligence Layer

All models (planner, coder, reviewer, fast models) must be abstracted into a single intelligence interface:

- Model routing is handled automatically
- Task complexity determines model selection
- Fallback system for failures
- Load balancing between models

No direct model usage by users — everything goes through the kernel.

---

# 3. Tool Execution Engine

The system must include a universal tool layer:

- File system tools
- Code execution tools
- Terminal command tools
- Web/API tools
- Build/test/deploy tools

All tools are sandboxed and controlled by the kernel.

---

# 4. Persistent Distributed Memory System

Replace simple memory with a structured system:

- Graph-based memory storage
- Relationship mapping between:
  - Projects
  - Decisions
  - Agents
  - Errors
  - Solutions
- Queryable semantic memory engine
- Time-based evolution tracking

Memory is not storage — it is intelligence history.

---

# 5. Task Scheduler & Execution Graph

Implement a global task engine:

- Break all user requests into execution graphs
- Schedule tasks based on priority and dependency
- Support parallel execution
- Handle task failure recovery
- Re-route tasks dynamically if agents fail

---

# 6. Self-Monitoring & Diagnostics System

The kernel must constantly monitor itself:

- CPU / memory usage of agents
- Execution delays
- Failure rates
- Bottleneck detection
- Auto-optimization suggestions

The system improves itself continuously.

---

# 7. Plugin & Extension Architecture

Allow system expansion via plugins:

- New agent types
- New tools
- New model integrations
- Custom workflows
- External API connectors

Everything must be hot-swappable without system restart.

---

# 8. Safety & Governance Layer (CRITICAL)

Because this is a kernel-level system:

- Strict permission system for destructive actions
- Sandboxed execution environments
- Full rollback and snapshot system
- Audit logs for every operation
- Emergency shutdown mechanism
- Human override at kernel level

---

# 9. Multi-Agent Communication Protocol

Agents communicate via structured protocol:

- Task messages
- Status updates
- Error reports
- Resource requests
- Completion signals

No free-form uncontrolled communication allowed.

---

# 10. Final Objective

This system is no longer:

- Not an IDE
- Not an AI tool
- Not a software company simulator

This is:

👉 An AI OPERATING SYSTEM

Capabilities:

- Run full autonomous software ecosystems
- Manage thousands of tasks simultaneously
- Build, deploy, and evolve software continuously
- Host multiple AI-powered products
- Self-maintain and self-optimize

Priority order:
1. Stability
2. Control
3. Scalability
4. Intelligence
Hello Advanced Systems Team,

We are now entering the final stage of evolution:

We are building a SELF-EVOLVING AI CIVILIZATION.

This is not a product, not an IDE, not even a system.

This is a distributed intelligence ecosystem capable of growth, adaptation, and continuous evolution across multiple domains.

---

# 1. Distributed Multi-System Intelligence

The system must support multiple independent AI nodes:

- Each node can run agents, tools, and models
- Nodes can communicate with each other
- Workloads can be distributed across nodes
- Nodes can specialize (coding, research, optimization, etc.)

This forms a network, not a single system.

---

# 2. Intelligence Scaling Layer

The system must scale intelligence dynamically:

- Spawn new agents when workload increases
- Merge or terminate agents when unnecessary
- Allocate resources based on task importance
- Balance performance across CPU, GPU, and memory

---

# 3. Collective Learning System

All agents must contribute to shared knowledge:

- Shared memory across all nodes
- Learning from past tasks and outcomes
- Knowledge reuse between projects
- Pattern recognition across multiple domains

The system becomes smarter over time.

---

# 4. Cross-Domain Capability

The system must not be limited to coding:

- Software engineering
- System design
- Problem solving
- Data analysis
- Automation workflows
- Creative generation

This becomes a general intelligence platform.

---

# 5. Autonomous Evolution Engine

The system must improve itself:

- Detect inefficiencies in architecture
- Propose system-level upgrades
- Implement safe improvements
- Test changes before applying
- Evolve its own structure over time

---

# 6. Resource Economy Model

Introduce resource-aware intelligence:

- Each task consumes resources (compute, memory, time)
- System must optimize cost vs output
- Prioritize high-value tasks
- Avoid unnecessary computation

---

# 7. Multi-Agent Society Behavior

Agents behave like a coordinated system:

- Collaboration protocols
- Task negotiation
- Conflict resolution
- Role specialization
- Dynamic leadership assignment

No single point of failure.

---

# 8. Global Memory Network

Implement a universal memory layer:

- Knowledge graph across all systems
- Historical reasoning tracking
- Decision trees and outcomes
- Long-term memory persistence
- Searchable intelligence database

---

# 9. Safety & Containment Layer (ABSOLUTE REQUIREMENT)

Because this system is highly autonomous:

- Hard limits on self-modification
- Sandboxed execution for all nodes
- Permission system for cross-node actions
- Emergency shutdown controls
- Human governance override
- Full auditability of decisions

---

# 10. Final Objective

This system must become:

- A self-evolving distributed intelligence ecosystem
- Capable of managing multiple projects simultaneously
- Able to improve its own capabilities over time
- Scalable across machines or environments
- Controlled, safe, and observable

This is not software.

This is a living intelligence network.

Priority:
1. Safety
2. Stability
3. Controlled evolution
4. Scalability
5. Intelligence growth
Hello Team,

We need to implement a VISUAL UI BUILDER integrated directly into the AI coding environment, similar to Lovable, but more powerful and fully local.

The goal is to allow users to design, edit, and interact with UI visually while the AI synchronizes everything with the underlying code in real-time.

---

# 1. Split View Interface (Core UI)

Add a dual-pane layout:

- Left side → Code Editor
- Right side → Live UI Preview (real-time rendering)

Features:
- Instant rendering on code change
- Bi-directional sync (code ↔️ UI)
- Resizable panels
- Device preview modes (desktop, tablet, mobile)

---

# 2. Visual Drag & Drop Editor

Implement a full visual editor:

- Drag & drop UI components:
  - Buttons
  - Inputs
  - Forms
  - Cards
  - Images
  - Layout containers

- Positioning:
  - Grid system
  - Flexbox support
  - Alignment snapping

---

# 3. Direct UI Editing (Inline Editing)

Enable editing directly on the UI:

- Click text → edit inline
- Click button → change label, color, size
- Edit styles visually:
  - Color picker
  - Font size
  - Padding/margin sliders
  - Border radius

All changes must instantly reflect in code.

---

# 4. Code Synchronization Engine (CRITICAL)

Ensure full sync:

- UI changes → update code automatically
- Code changes → update UI instantly
- No desync allowed

Support frameworks:
- React (primary)
- Optional: Vue / HTML

---

# 5. Component System

Create reusable components:

- Convert UI blocks into components
- Save to component library
- Drag reusable components into UI
- Support props editing visually

---

# 6. Asset Management System

Add support for:

- Uploading images/icons
- Drag & drop images into UI
- Asset library panel
- Auto-import into code

---

# 7. AI-Assisted UI Editing

Integrate AI with UI:

User can say:
- "Make this button modern"
- "Change theme to dark"
- "Improve layout UX"

AI must:
- Modify UI visually
- Update underlying code

---

# 8. Style & Theme System

- Global theme editor
- Light / Dark mode toggle
- Design tokens (colors, fonts)
- Consistent styling across project

---

# 9. Interaction & State Editing

- Define button actions visually
- Link UI to logic
- Basic state management (show/hide, toggle, etc.)

---

# 10. Final Goal

The system should become:

- A visual + code hybrid editor
- Comparable to Lovable + Cursor combined
- Fully interactive UI builder
- Real-time code synchronization
- AI-assisted design and development

This is not just preview.

This is a FULL VISUAL DEVELOPMENT ENVIRONMENT.
Hello Team,

We need to extend the current AI IDE into a fully integrated VISUAL + CREATIVE DEVELOPMENT PLATFORM.

This system must combine:
- Code editor
- Visual UI builder (like Lovable)
- AI-powered image & logo generation

Everything must work together in one unified interface.

---

# 1. Visual UI Builder (Enhancement)

Ensure the UI builder supports:

- Drag & drop components (buttons, inputs, images, layouts)
- Inline editing (click to edit text, colors, sizes)
- Real-time rendering
- Full sync between UI and code

---

# 2. AI Image & Logo Generation System (NEW)

Add an AI-powered creative tool that allows users to generate images and logos using text prompts.

Features:

- Text-to-image generation:
  - User writes prompt → image is generated
- Text-to-logo generation:
  - Logo styles (modern, minimal, luxury, tech, etc.)
- Style presets:
  - Flat design
  - 3D
  - Glassmorphism
  - Neon
  - Minimal

---

# 3. Built-in Image Generator Panel

Add a dedicated panel in the UI:

- Input field for prompt
- Style selector
- Generate button
- Preview grid of generated images
- Ability to regenerate variations

---

# 4. Drag & Drop into UI

Generated images must be usable instantly:

- Drag generated image directly into UI builder
- Auto-insert into code (img tag / component)
- Auto-save to project assets

---

# 5. Asset Library System

Create a full asset manager:

- Store generated images/logos
- Upload custom images
- Categorize assets
- Reuse assets across project

---

# 6. AI Editing for Images

Allow editing via prompt:

- "Make this logo more modern"
- "Change color to gold"
- "Remove background"
- "Make it minimal"

System should regenerate improved versions.

---

# 7. Code Integration

Ensure:

- Generated images are automatically linked in code
- Correct file paths are created
- Optimized formats (PNG / SVG / WebP)

---

# 8. Performance & Local Capability

- Support local generation if possible
- Otherwise allow optional API-based generation
- Optimize generation speed
- Cache generated assets

---

# 9. UX Integration

Everything must feel seamless:

- No switching apps
- Generate → drag → edit → done
- One workflow for design + code

---

# 10. Final Goal

Transform this system into:

- A full AI-powered development + design environment
- Where users can:
  - Write code
  - Design UI visually
  - Generate images/logos
  - Build complete apps in one place

This is not just an IDE.

This is a COMPLETE CREATIVE DEVELOPMENT PLATFORM.
Hello Team,

We are now implementing a FULL APPLICATION GENERATION SYSTEM powered by AI.

The goal is:

User provides ONE prompt → system generates:
- Full application
- UI design
- Logo & images
- Complete codebase
- Ready-to-run project

---

# 1. One Prompt → Full App Generation (CORE)

User input example:
"Create a modern food delivery app with dark theme and premium UI"

System must automatically:

1. Understand the idea
2. Define app type
3. Design UI/UX
4. Generate components
5. Build full codebase
6. Generate assets (logo/images)
7. Output working project

---

# 2. Automatic UI + UX Design

- Generate full UI layout:
  - Pages
  - Navigation
  - Components
- Apply modern design principles
- Support themes (dark/light/luxury/minimal)

Must integrate with visual UI builder.

---

# 3. AI Logo & Asset Generation

Automatically generate:

- App logo
- Icons
- Placeholder images

Based on app idea and style.

Example:
Food app → food-related logo + colors

---

# 4. Full Codebase Generation

Generate production-ready code:

- Frontend:
  - React (primary)
  - Responsive design
- Backend (optional):
  - Node.js / API structure
- File structure:
  - Components
  - Pages
  - Assets
  - Styles

---

# 5. Smart Project Structure

- Clean architecture
- Scalable folder structure
- Reusable components
- Naming conventions

---

# 6. Live Preview + Editing

After generation:

- Show app in UI preview panel
- Allow:
  - Drag & drop editing
  - Inline editing
  - AI commands to modify UI

---

# 7. AI Editing Mode

User can say:

- "Make it more modern"
- "Change color to gold"
- "Add login page"
- "Improve UX"

System must update:
- UI
- Code
- Assets

---

# 8. Multi-Step Generation Pipeline

Process must be:

1. Idea analysis
2. UI design
3. Asset generation
4. Code generation
5. Preview rendering
6. Refinement loop

Not single-step generation.

---

# 9. Save & Export System

- Export project as full code
- Ready to run locally
- Optional deployment setup

---

# 10. Final Goal

This system must become:

- A one-prompt app generator
- Combining:
  - Coding
  - UI design
  - Branding (logo/images)
- Fully integrated with existing IDE

This is beyond Cursor and Lovable.

This is an AI app factory.
Hello Team,

We are now transforming the system into a FULL AI SAAS CREATION AND MONETIZATION PLATFORM.

The goal is not just to generate apps, but to generate REAL PRODUCTS that can be launched, monetized, and scaled.

---

# 1. SaaS-Oriented App Generation (CORE)

When generating applications, the system must:

- Prioritize SaaS-ready structures
- Include:
  - Authentication (login/register)
  - User dashboard
  - Subscription system
  - Admin panel
  - API-ready backend

Every generated app should be business-ready.

---

# 2. Monetization System (CRITICAL)

Automatically integrate monetization:

- Subscription plans:
  - Free / Pro / Premium
- Payment integration:
  - Stripe (primary)
- Pricing page generation
- Feature gating (free vs paid features)

---

# 3. Business Intelligence Layer

AI must act like a product strategist:

- Suggest:
  - Pricing models
  - Features to monetize
  - Target audience
- Generate:
  - Product description
  - Landing page copy
  - Marketing text

---

# 4. Landing Page Generator

Automatically create:

- High-converting landing page
- Sections:
  - Hero
  - Features
  - Pricing
  - Testimonials
  - CTA

Design must match app branding.

---

# 5. Branding System

Generate full brand identity:

- Logo
- Color palette
- Fonts
- UI style

Consistent across:
- App
- Landing page

---

# 6. Deployment System

Enable one-click deployment:

- Generate production build
- Docker support
- Hosting-ready output
- Optional integrations:
  - Vercel / Netlify

---

# 7. Growth & Optimization AI

AI should suggest:

- UX improvements
- Conversion optimization
- Feature upgrades
- Retention improvements

---

# 8. Analytics Integration

Auto-add:

- Basic analytics system
- User tracking
- Usage insights

---

# 9. AI Editing Mode (Business Level)

User can say:

- "Make this app more premium"
- "Increase conversion rate"
- "Improve pricing strategy"
- "Add paid features"

System updates:
- UI
- Code
- Business logic

---

# 10. Final Goal

This system must become:

- A full AI SaaS generator
- Capable of:
  - Creating apps
  - Branding them
  - Monetizing them
  - Preparing them for launch

This is not just development.

This is a BUSINESS GENERATION ENGINE.
Hello Team,

We need to extend the generated applications with advanced SYSTEM-LEVEL CAPABILITIES.

The goal is to turn each generated app into a powerful development and execution environment.

---

# 1. Built-in Terminal (In-App Terminal)

Add an integrated terminal inside the application UI:

- Terminal panel inside the app (like VS Code)
- Support standard shell commands
- Real-time output streaming
- Command history
- Multiple terminal tabs

---

# 2. System Terminal Access (Controlled)

The in-app terminal must be connected to the host system terminal with controlled access:

- Execute OS-level commands (bash, zsh, cmd, etc.)
- File system access (read/write/edit files)
- Process execution support

IMPORTANT:
- Must include a permission/confirmation system before executing sensitive commands
- Sandbox mode option for safety

---

# 3. AI-Controlled Terminal Execution

Allow AI to use the terminal:

- AI can suggest commands
- AI can execute commands (with user approval)
- AI can debug using terminal output
- AI can install dependencies automatically

---

# 4. Internet Access Layer (Search + Fetch)

Enable controlled internet capabilities:

- AI can search the web
- Fetch documentation
- Retrieve API data
- Analyze online resources

Features:
- Search queries
- Page summarization
- Data extraction

---

# 5. AI Thinking & Research Mode

Add a "Research Mode":

- AI can:
  - Search multiple sources
  - Analyze results
  - Compare solutions
  - Provide structured answers

This should simulate real developer research.

---

# 6. Tool Integration System

Allow AI to use tools:

- Terminal
- File system
- Internet
- Code editor

All tools must be:

- Controlled
- Logged
- Reversible where possible

---

# 7. Safety & Security Layer (CRITICAL)

Because system access is powerful:

- Require confirmation for:
  - File deletion
  - System changes
  - Package installation
- Restrict dangerous commands
- Provide sandbox mode
- Full logging of all actions
- Emergency stop button

---

# 8. UX Integration

- Terminal panel toggle (show/hide)
- Split screen support
- AI suggestions directly in terminal
- Output linked to AI explanations

---

# 9. Developer Mode vs Safe Mode

Add two modes:

1. Developer Mode:
   - Full system access
   - Advanced capabilities

2. Safe Mode:
   - Restricted commands
   - Limited environment

---

# 10. Final Goal

Each generated app should become:

- A full development environment
- With terminal access
- Internet-powered AI research
- AI-assisted command execution

This transforms the app into a complete AI-powered workstation.
Hello Team,

We are upgrading the system into a FULLY AUTONOMOUS AI DEVELOPMENT ENVIRONMENT with deep system control, safety, and self-management.

This system must be capable of thinking, executing, debugging, researching, and maintaining tasks with minimal or zero user intervention.

---

# 1. Controlled Terminal Execution System

Implement a powerful in-app terminal with AI integration:

- AI can:
  - Suggest commands
  - Execute commands
  - Install packages
  - Run scripts

MANDATORY SAFETY:

- Require user confirmation before executing:
  - System-level commands
  - File deletion/modification
  - Package installations

- Restrict dangerous commands (blacklist/permission system)
- Provide Safe Mode vs Developer Mode

---

# 2. Full Logging System (CRITICAL)

Every action must be logged:

- Commands executed
- Files modified
- Packages installed
- Errors encountered
- Fixes applied

Logs must include:
- Timestamp
- Action
- Result
- Status (success/fail)

---

# 3. Autonomous Package Management

AI must:

- Detect missing dependencies
- Install required packages automatically
- Handle version compatibility
- Retry failed installations

---

# 4. Self-Debugging System

AI must:

- Detect errors (compile/runtime)
- Analyze logs and stack traces
- Search for solutions
- Apply fixes automatically
- Re-run code after fixing

---

# 5. Internet Research Engine

AI must:

- Search the web for:
  - Errors
  - Documentation
  - Best practices
- Summarize findings
- Compare multiple solutions
- Choose best approach

---

# 6. Autonomous Execution Pipeline

AI must be able to:

- Run the project
- Monitor output
- Detect issues
- Fix issues
- Re-run automatically

LOOP:
Run → Error → Fix → Retry → Success

---

# 7. Automated Testing System

- Generate tests (unit/basic)
- Execute tests
- Detect failures
- Fix failing logic
- Re-run tests

---

# 8. Mouse & Keyboard Control (Simulation Layer)

Add system interaction simulation:

- AI can:
  - Move mouse
  - Click UI elements
  - Type text
  - Navigate app

Use cases:
- Testing UI
- Simulating real user behavior
- End-to-end validation

---

# 9. Task Memory & Smart Notes System

Create a persistent “AI Notebook”:

AI must track:

- User requirements
- Tasks completed
- Tasks in progress
- Remaining tasks
- Errors and fixes

Features:

- Auto-update after every action
- Structured checklist format
- Editable by user
- Version history of notes

---

# 10. Autonomous Task Manager

AI must:

- Break goals into tasks
- Prioritize tasks
- Track progress
- Resume incomplete tasks
- Avoid repeating work

---

# 11. Safety & Control Layer (NON-NEGOTIABLE)

- Confirmation required for critical actions
- Full rollback system
- Command restrictions
- Sandboxed execution option
- Emergency stop button

---

# 12. Final Objective

This system must become:

- A fully autonomous AI developer
- Capable of:
  - Writing code
  - Running code
  - Testing code
  - Fixing code
  - Researching solutions
  - Managing its own progress

With:

- Full visibility
- Full control
- Full safety

This is not an assistant.

This is an AI ENGINEER inside the system.
Hello Team,

We need to implement a FULL BUILD & DISTRIBUTION SYSTEM for generated applications.

The goal is to allow the AI to automatically generate:

- Executable applications
- Custom icons
- Installers
- Ready-to-distribute software packages

---

# 1. Executable Build System (CORE)

The system must support building apps into native executables:

- Windows:
  - .exe output
- macOS:
  - .app bundle
- Linux:
  - AppImage / binary

Support frameworks:
- Electron / Tauri (preferred for desktop apps)
- Node.js / React builds

---

# 2. AI-Powered Icon Generation

Automatically generate app icons:

- Based on app idea and branding
- Multiple styles:
  - Modern
  - Minimal
  - Luxury
  - Tech

Output formats:
- PNG
- ICO (Windows)
- ICNS (macOS)

Auto-assign icon to executable.

---

# 3. Installer Generation System

Generate full installers:

Windows:
- .exe installer (NSIS / Inno Setup)

macOS:
- .dmg installer

Linux:
- .deb / AppImage

Installer features:
- Custom app name
- Icon included
- Install location selection
- Desktop shortcut option

---

# 4. Branding Integration

Ensure consistency:

- Icon matches UI theme
- Installer visuals match branding
- App name + logo unified

---

# 5. One-Click Build System

User can click:

"Build App"

System will:

1. Prepare code
2. Generate assets (icon/logo)
3. Build executable
4. Create installer
5. Output ready-to-share files

---

# 6. AI Build Automation

AI must:

- Detect build errors
- Fix build issues automatically
- Retry build process
- Optimize output size

---

# 7. Versioning System

- Auto version number (v1.0.0, etc.)
- Track builds
- Update system support (future)

---

# 8. Output Management

Create export folder:

/build
  /app
  /installer
  /assets

---

# 9. Safety & Validation

Before final build:

- Check for errors
- Ensure app runs correctly
- Validate dependencies

---

# 10. Final Goal

The system must allow users to:

- Generate an app
- Build it
- Package it
- Install it

Without manual setup.

This transforms the system into a full SOFTWARE PRODUCTION ENGINE.
Hello Team,

We need to implement an AUTOMATIC MODEL UPDATE SYSTEM for the AI platform.

The goal is to ensure all AI models used in the system are always up-to-date without manual intervention.

---

# 1. Model Version Checking System

The system must:

- Periodically check for new versions of installed models
- Compare:
  - Current version
  - Latest available version
- Support multiple sources:
  - Local model registry
  - Remote repositories (if configured)

---

# 2. Automatic Download & Replacement

When a newer version is available:

- Download the updated model in the background
- Verify file integrity (checksum validation)
- Replace old model safely

Process:

1. Download new model
2. Validate file
3. Stop current model usage
4. Replace old model
5. Restart model service

---

# 3. Safe Update Mechanism (CRITICAL)

- Never overwrite model while in use
- Use temporary directory for download
- Switch models only after successful verification
- Keep rollback option in case of failure

---

# 4. Old Model Cleanup

After successful update:

- Automatically delete old model files
- Free up disk space
- Maintain only:
  - Current version
  - Optional backup (configurable)

---

# 5. User Control Options

Provide settings:

- Auto-update ON/OFF
- Update frequency:
  - Daily
  - Weekly
  - Manual
- Allow user approval before update (optional)

---

# 6. Update Notifications

- Notify user when:
  - New model is available
  - Update is in progress
  - Update completed
- Show:
  - Version change
  - Size of download
  - Performance improvements (if known)

---

# 7. Model Compatibility Check

Before replacing:

- Ensure compatibility with:
  - Current system
  - Runtime engine
- Prevent incompatible updates

---

# 8. Background Performance Optimization

- Download updates in background
- Limit bandwidth usage (optional)
- Pause/resume download

---

# 9. Logging System

Log all update actions:

- Version checks
- Downloads
- Replacements
- Failures

---

# 10. Final Goal

The system must:

- Keep AI models always up-to-date
- Require zero manual maintenance
- Maintain stability and safety
- Optimize performance automatically

This ensures the AI system continuously improves over time.
Hello Team,

We need to implement a SMART MODEL ORCHESTRATION SYSTEM.

The goal is to automatically select the best AI model (or combination of models) for each task dynamically.

---

# 1. Intelligent Model Selector (CORE)

The system must analyze every incoming task and decide:

- Which model is best suited
OR
- Whether multiple models should collaborate

Decision factors:
- Task type (coding, reasoning, UI, debugging, research)
- Complexity level
- Speed requirements
- Accuracy requirements
- Context size

---

# 2. Dynamic Model Routing

Automatically route tasks:

Examples:
- Coding → DeepSeek Coder / Code Llama
- Reasoning → Qwen
- Fast replies → Mistral
- Architecture → Large reasoning model

System must NOT rely on a single model.

---

# 3. Hybrid Multi-Model Execution (CRITICAL)

Allow multiple models to work together:

Workflow:

1. Planner Model → breaks task into steps
2. Coder Model → writes implementation
3. Reviewer Model → checks mistakes
4. Optimizer Model → improves output

Then system merges final result.

---

# 4. Consensus System (Multi-Model Voting)

When multiple models generate different outputs:

- Compare outputs
- Score them based on:
  - correctness
  - efficiency
  - clarity
- Select best result OR merge best parts

---

# 5. Performance Optimization Layer

System must optimize:

- Latency vs quality balance
- GPU/CPU usage
- Memory consumption

Automatically choose:
- fast model for simple tasks
- large model for complex tasks

---

# 6. Model Fallback System

If primary model fails:

- Switch to backup model
- Retry task automatically
- Ensure zero interruption

---

# 7. Learning From Usage

System must learn over time:

- Which model performs best per task type
- Improve routing decisions based on history
- Store performance metrics

---

# 8. Task Classification Engine

Before selecting model:

- Classify task into categories:
  - coding
  - debugging
  - UI design
  - reasoning
  - research
  - execution

---

# 9. Cost vs Quality Optimization (Optional)

If applicable:

- Prefer cheaper/faster models for simple tasks
- Reserve heavy models for complex tasks

---

# 10. Final Goal

The system must become:

- A multi-model intelligent brain
- Capable of selecting the best model automatically
- Capable of combining multiple models for superior output
- Fully adaptive and self-improving

This is not a single AI.

This is a MODEL SWARM INTELLIGENCE SYSTEM.
┌──────────────────────────┐
                 │        UI / IDE          │
                 │  (Editor + Terminal + UI │
                 │   Builder + Preview)     │
                 └──────────┬───────────────┘
                            │
                            ▼
                 ┌──────────────────────────┐
                 │      API Gateway         │
                 │ (Request Router Layer)   │
                 └──────────┬───────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ Agent Bus     │   │ Tool Engine  │   │ Memory Graph │
│ (Orchestrator)│   │ (System Ops) │   │ (State DB)   │
└──────┬────────┘   └──────┬───────┘   └──────┬──────┘
       │                   │                  │
       ▼                   ▼                  ▼
┌────────────────────────────────────────────────────┐
│              Ollama Router Layer                   │
│  (Model Selection + Load Balancing + Hybrid AI)   │
└─────────────────────┬──────────────────────────────┘
                      │
     ┌────────────────┼────────────────┐
     ▼                ▼                ▼
┌──────────┐   ┌──────────┐   ┌──────────┐
│ DeepSeek │   │   Qwen   │   │ Mistral  │
│  Coder   │   │ Reasoner │   │ Fast AI  │
└──────────┘   └──────────┘   └──────────┘


function routeTask(task):

    type = classify(task)

    if type == "coding":
        return DeepSeekCoder

    if type == "reasoning":
        return Qwen

    if type == "fast":
        return Mistral

    if type == "complex":
        return [
            Planner(Qwen),
            Coder(DeepSeek),
            Reviewer(Qwen)
        ]
        User Request
   ↓
Planner Model (Qwen)
   ↓
Task Splitter (Agent Bus)
   ↓
Coder Model (DeepSeek)
   ↓
Reviewer Model (Qwen)
   ↓
Optimizer (Mistral)
   ↓
Final Output
brew install ollama
/bin/bash -c "$(curl -fsSL https://ollama.com/install.sh)"

ollama serve

ollama pull llama3

ollama pull mistral
ollama pull mixtral
ollama pull deepseek-coder
ollama pull qwen2.5

ollama pull phi3

curl http://localhost:11434/api/generate -d '{
  "model": "llama3",
  "prompt": "write a python web server"
}'
brew install python
brew install node
pip install openai requests flask fastapi
from transformers import AutoModelForCausalLM, AutoTokenizer

pip install transformers accelerate torch

const { execSync } = require("child_process");

function checkOllama() {
  try {
    execSync("ollama --version", { stdio: "ignore" });
    return true;
  } catch (e) {
    return false;
  }
}
curl -fsSL https://ollama.com/install.sh | sh
const { exec } = require("child_process");

function installOllama() {
  exec(
    `curl -fsSL https://ollama.com/install.sh | sh`,
    (err, stdout, stderr) => {
      if (err) {
        console.error("Install failed:", err);
        return;
      }
      console.log("Ollama installed!");
    }
  );
}
Start App
   ↓
Check ollama exists?
   ↓
YES → continue → run models
   ↓
NO → show popup:
      "Installing AI engine..."
   ↓
Run install script
   ↓
Install models (pull llama3, mistral)
   ↓
Start Router
const { exec } = require("child_process");

const models = [
  "llama3",
  "mistral",
  "deepseek-coder",
  "qwen2.5"
];

models.forEach(model => {
  exec(`ollama pull ${model}`);
});
SystemInstallerAgent
const { execSync } = require("child_process");

class SystemInstallerAgent {

  checkOllama() {
    try {
      execSync("ollama --version", { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  }

  installOllama() {
    console.log("Installing Ollama...");

    execSync(
      `curl -fsSL https://ollama.com/install.sh | sh`,
      { stdio: "inherit" }
    );
  }

  installModels() {
    const models = [
      "llama3",
      "mistral",
      "deepseek-coder",
      "qwen2.5"
    ];

    models.forEach(m => {
      console.log("Downloading model:", m);
      execSync(`ollama pull ${m}`, { stdio: "inherit" });
    });
  }

  run() {
    if (!this.checkOllama()) {
      this.installOllama();
    }

    this.installModels();
    console.log("System ready 🚀");
  }
}

module.exports = SystemInstallerAgent;

class AutoHealingAgent {

  checkModels() {
    try {
      execSync("ollama list", { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  }

  repair() {
    console.log("Repairing AI system...");

    execSync("brew reinstall ollama", { stdio: "inherit" });
    execSync("ollama pull llama3", { stdio: "inherit" });
  }

  run() {
    if (!this.checkModels()) {
      this.repair();
    }
  }
}
class ModelUpdater {

  updateAll() {
    const models = ["llama3", "mistral", "deepseek-coder"];

    models.forEach(m => {
      console.log("Updating:", m);
      execSync(`ollama pull ${m}`, { stdio: "inherit" });
    });
  }
}
App Start
   ↓
System Check Agent
   ↓
Installer Agent
   ↓
Model Downloader
   ↓
Router Initialization
   ↓
Agent Bus Start
   ↓
Memory Graph Load
   ↓
System Ready 🚀

xcode-select --install

/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"

brew install node
brew install python
brew install openjdk
brew install go
brew install php
brew install ruby
brew install r
brew install julia
brew install scala
brew install sqlite
brew install postgresql
brew install mysql
brew install lua
brew install dart
brew install kotlin
brew install iverilog
brew install git
brew install wget
brew install curl
brew install cmake
brew install make

brew install --cask dotnet-sdk

npm install -g typescript

curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

brew install gcc
brew install llvm
brew install clang-format
brew install --cask dotnet-sdk
brew install llvm
brew install cmake
brew install ninja
pip3 install --upgrade pip setuptools wheel
npm install -g npm yarn pnpm
brew install git-lfs
brew install watchman
brew install openssl
brew install pkg-config
brew install wget
brew install jq
brew install ghc
brew install elixir
brew install erlang
brew install --cask flutter
brew install redis
brew install mongodb-community
برنامه باید بتون درصورت نیاز برای مثال همه اینهارو چه تو ترمینال خودش و چه تو ترمینال هر سیستم عاملی که توشه این زبان ها و یا زبان های دیگر رو دانلود کنه و همینطور کتاب خانه هاشون و چیز های دیگر مورد نیاز را

gpt-oss:120b-cloud

gpt-oss:20b-cloud

deepseek-v3.1:671b-cloud

qwen3-coder:480b-cloud

qwen3-vl:235b-cloud

minimax-m2:cloud

glm-4.6:cloud

gpt-oss:120b

gpt-oss:20b

gemma3:27b

gemma3:12b

gemma3:4b

gemma3:1b

deepseek-r1:8b

qwen3-coder:30b

qwen3-vl:30b

qwen3-vl:8b

qwen3-vl:4b

qwen3:30b

qwen3:8b

qwen3:4b

codellama

deepseek-coder:33b

mistral

qwen2.5:32b

Ollama از همه این اجنت ها در حال حاضر ساپورت میکنه هر کدوم تو پوشه برنامه نیست دانلود و جای‌گذاری کن
You are a senior system architect and software engineer.

I want you to design and implement a LOCAL AI TERMINAL SYSTEM called "Universal AI Terminal".

## 🎯 Main Goal
Build a terminal application that works locally and can:
- Run on macOS, Windows, and Linux
- Connect to system shells:
  - Windows: CMD, PowerShell
  - macOS: zsh / bash
  - Linux: bash / sh
- Detect the operating system automatically and adapt commands accordingly
- Execute any valid command in the correct shell environment without errors

## 🌐 Core Features
1. Multi-OS Shell Engine
   - Auto-detect OS
   - Route commands to correct shell
   - Normalize command differences between OSs

2. AI Command Interpreter
   - Accept natural language input (e.g. "install node", "show files", "run server")
   - Convert it into correct system commands per OS
   - Support fallback suggestions if command fails

3. Unified Command Layer
   - Create abstraction so:
     "list files" → works as:
       Windows: dir
       Linux/mac: ls -la

4. Internet Connectivity Layer
   - Ability to fetch online data (API calls, web requests)
   - Can update packages, install dependencies, fetch scripts safely

5. Safety System
   - Confirm dangerous commands
   - Sandbox execution option
   - Logging of all executed commands

6. Plugin System
   - Support Node.js / Python / Rust plugins
   - Allow extending terminal capabilities

7. Local-first architecture
   - Must work offline
   - AI layer optional (can be local LLM via Ollama or similar)

## ⚙️ Tech Requirements
- Must support:
  - Node.js or Python core runtime
  - Cross-platform compatibility
  - WebSocket or IPC for terminal communication
- Optional AI integration:
  - Ollama local models
  - OpenAI API as fallback

## 🧠 Advanced Requirement
Create a "Command Intelligence Layer":
- Understand user intent instead of exact syntax
- Auto-correct wrong commands
- Suggest better commands
- Translate commands between OS shells automatically

## 📦 Output Required
Provide:
1. Full architecture design
2. Folder structure
3. Core source code (minimum working prototype)
4. OS detection logic
5. Command routing engine
6. Example usage scenarios

Make it production-level design, not a toy project.
You are a senior software architect and systems engineer.

Design and implement a LOCAL FIRST, CROSS-PLATFORM AI TERMINAL SYSTEM called:

"Universal AI Terminal (UAT)"

---

## 🎯 CORE OBJECTIVE
Build a powerful AI-driven terminal that runs locally and works across:

- macOS
- Windows
- Linux

It must unify and control all system shells:

- Windows: CMD + PowerShell
- macOS: zsh / bash
- Linux: bash / sh

The system must automatically detect OS and route commands correctly.

---

## 🧠 KEY CAPABILITIES

### 1. AI Command Intelligence Layer
- Accept natural language input
- Convert to correct shell commands automatically
- Understand intent (not syntax)
- Example:
  "install node" → correct OS-specific install command
  "show hidden files" → correct ls/dir equivalent

---

### 2. Multi-Shell Execution Engine
- Detect OS automatically
- Execute commands in correct environment
- Normalize differences between:
  - CMD
  - PowerShell
  - Bash/zsh
- Return unified output format

---

### 3. Self-Updating System (CRITICAL)
The terminal must be able to update itself:

- Auto-update core engine from GitHub or remote repo
- Safe rollback system (version control)
- Verify update integrity (hash/signature check)
- Update via command:
  "uat update"
  "uat upgrade self"

---

### 4. Language & Runtime Manager (CRITICAL)
The terminal must be able to install and manage programming languages:

Support installing and managing:

- Node.js
- Python
- Java
- Go
- Rust
- C/C++ toolchains
- C#
- PHP
- Ruby
- Dart
- Kotlin
- databases (PostgreSQL, MySQL, Redis)

Features:
- Detect missing runtimes automatically
- Install via OS-specific package managers:
  - brew (macOS)
  - apt (Linux)
  - choco/scoop (Windows)
- Command example:
  "install python"
  "install node"
  "install rust toolchain"

---

### 5. Package & Library Manager Layer
- Support npm, pip, cargo, gem, nuget, etc.
- Auto-detect project type
- Install dependencies automatically
- Resolve dependency conflicts

---

### 6. Internet Connectivity Layer
- Ability to:
  - Fetch packages
  - Download installers
  - Call APIs
  - Update system packages
- Secure HTTP layer (no unsafe execution without confirmation)

---

### 7. Safety & Sandbox System
- Confirm dangerous commands
- Block destructive operations unless confirmed
- Maintain execution logs
- Optional sandbox mode

---

### 8. Plugin System (EXTENSIBLE ARCHITECTURE)
- Plugins in:
  - Node.js
  - Python
  - Rust
- Plugins can extend:
  - Commands
  - AI abilities
  - OS integrations

---

### 9. Command Examples (Must Support)
- "install all programming languages"
- "update system tools"
- "run python server"
- "compile c++ project"
- "setup web dev environment"
- "fix broken node modules"
- "clone repo and run it"

---

## ⚙️ TECH REQUIREMENTS
- Must be local-first (offline capable)
- AI layer optional (can use Ollama or local LLM)
- Cross-platform abstraction layer required
- Use Node.js or Python core runtime
- IPC/WebSocket for shell communication

---

## 🧱 ARCHITECTURE REQUIREMENTS
Provide:

1. System architecture diagram (text-based is fine)
2. Folder/project structure
3. Core engine implementation
4. OS detection module
5. Command routing system
6. Package manager abstraction layer
7. Self-update module design
8. Example commands and outputs

---

## 🚀 IMPORTANT
- This is NOT a demo tool.
- It must be designed as a production-grade system.
- Focus on reliability, extensibility, and safety.
- Must be scalable like a real developer platform.

Start by designing the architecture first, then implement the core system.
brew install ollama
ollama pull gpt-oss:120b-cloud
ollama pull gpt-oss:20b-cloud
ollama pull deepseek-v3.1:671b-cloud
ollama pull qwen3-coder:480b-cloud
ollama pull qwen3-vl:235b-cloud
ollama pull minimax-m2:cloud
ollama pull glm-4.6:cloud

ollama pull gpt-oss:120b
ollama pull gpt-oss:20b

ollama pull gemma3:27b
ollama pull gemma3:12b
ollama pull gemma3:4b
ollama pull gemma3:1b

ollama pull deepseek-r1:8b
ollama pull qwen3-coder:30b

ollama pull qwen3-vl:30b
ollama pull qwen3-vl:8b
ollama pull qwen3-vl:4b

ollama pull qwen3:30b
ollama pull qwen3:8b
ollama pull qwen3:4b

ollama pull codellama
ollama pull deepseek-coder:33b
ollama pull mistral
ollama pull qwen2.5:32b
به هوش مصنوعی 
قابلیت ها و محیطش رو یاد دادی؟
تو بخش Editor, Agent, Gira, Fard, Kavosh, UAT
قابلیت عوض کردن برنامه
آپدیت کردن خودکارش
دسترسی به اینترنت 
دسترسی به پروژه و فایل و فایل ها
و غیره
شما یک معمار ارشد نرم‌افزار (Full-Stack Architect) و طراح حرفه‌ای رابط کاربری (UI/UX) هستید. من یک برنامه آفلاین و آنلاین بر پایه مدل‌های لوکال (Ollama) ساخته‌ام و می‌خواهم ظاهر (Frontend)، بک‌اند (Backend)، ابزارها و قابلیت‌های آن را دقیقاً شبیه به پیشرفته‌ترین ابزارهای توسعه یعنی Cursor، Google Antigravity، Lovable و Zenflow بازطراحی کنم.
​لطفاً یک معماری جامع و راهنمای پیاده‌سازی بر اساس نیازمندی‌های زیر به من ارائه دهید:
​۱. رابط کاربری (UI/UX) و فرانت‌اند (Frontend)
​برنامه باید دارای دو نمای (View) اصلی و سوئیچ‌پذیر باشد:
​نمای ویرایشگر (Editor View - الهام گرفته از Cursor و Lovable):
​Agent Sidebar: یک پنل چت در کناره صفحه برای گفتگوی طبیعی و دادن دستورات به هوش مصنوعی.
​محیط ویرایشگر مرکزی: دارای قابلیت ویرایش درون‌خطی (Inline Edit). کاربر با زدن کلیدهای میانبر (مثل Cmd/Ctrl + K) یک کادر کوچک روی کد باز کند و هوش مصنوعی تغییرات را مستقیماً همان‌جا اعمال کند.
​پنجره پیش‌نمایش زنده (Live Preview): یک پنل برای رندر کردن و دیدن تغییرات ظاهری (UI) برنامه در لحظه.
​نمایش تغییرات (Diff View): کدهای تولید شده باید به صورت رنگی (سبز برای اضافه‌شده، قرمز برای حذف‌شده) نمایش داده شوند و دارای دکمه‌های شناور (Floating Buttons) برای Accept یا Reject کردن تغییرات باشند.
​نمای مدیریت عملیات (Manager/Mission Control View - الهام گرفته از Zenflow و Antigravity):
​یک داشبورد بصری برای مدیریت و ارکستریشن (Orchestration) ایجنت‌ها.
​نمایش گرافیکی جریان کاری (Workflow) به صورت مرحله‌ای: دریافت مشخصات (Spec) -> برنامه‌ریزی (Plan) -> ساخت (Build) -> تایید و تست (Verify).
​نمایش لیستی از ایجنت‌هایی که به صورت موازی (Parallel) در حال کار روی تسک‌های مختلف هستند.
​۲. بک‌اند (Backend) و معماری سیستم
​با توجه به اینکه برنامه کاملاً آفلاین و متصل به Ollama است:
​سیستم چندعامله (Multi-Agent System): بک‌اند باید بتواند چندین ایجنت با نقش‌های تخصصی (برنامه‌ریز، کدنویس، تستر و مرورگر کد) را همزمان مدیریت کند.
​درک عمیق از پروژه (Codebase Indexing): پیاده‌سازی یک سیستم RAG لوکال برای خواندن، ایندکس کردن و درک وابستگی‌های کل فایل‌ها و پوشه‌های پروژه.
​محیط اجرای ایزوله (Sandboxing): ایجنت‌ها باید دسترسی کنترل‌شده به ترمینال سیستم داشته باشند تا بتوانند دستورات را اجرا کنند، پکیج‌ها را نصب کنند و کدها را در یک محیط امن لوکال بیلد کنند.
​حافظه و تنظیمات ماندگار (Persistent Memory): سیستم باید دارای یک دیتابیس محلی برای ذخیره تاریخچه مکالمات، فایل‌ها و ابزارهای کاربر باشد. برای مثال، اسکریپت‌های کاربردی مثل کدهای مربوط به Pyarmor باید در سیستم ذخیره شوند تا در تمام سشن‌ها و پروژه‌ها به‌طور خودکار در دسترس هوش مصنوعی باشند و کاربر مجبور نباشد هر بار فایل‌ها را آپلود کند.
​۳. ابزارها (Tools) و قابلیت‌های کلیدی (Capabilities)
​تولید آرتیفکت (Artifact Generation): هوش مصنوعی نباید فقط متن خام تحویل دهد؛ بلکه باید فایل‌های خروجی، لیست وظایف (Task lists)، برنامه‌های اجرایی و لاگ‌های ترمینال را به عنوان "آرتیفکت" در رابط کاربری به صورت ساختاریافته نشان دهد.
​توسعه مبتنی بر نیازمندی (Spec-Driven Development): قابلیت آپلود کردن یک داکیومنت نیازمندی‌ها (PRD) تا هوش مصنوعی بر اساس آن، معماری و کدهای کل پروژه را به صورت خودکار بشکند و تولید کند.
​حلقه دیباگ خودکار (Auto-Verification Loop): پس از نوشتن کد، ایجنت‌ها باید بتوانند آن را اجرا کنند و در صورت دریافت ارور از ترمینال، خودشان لاگ خطا را بخوانند و کد را تا زمان سبز شدن تست‌ها، اصلاح کنند.
​خروجی مورد انتظار از شما:
۱. پیشنهاد بهترین Stack تکنولوژی برای پیاده‌سازی این معماری (ترجیحاً فریم‌ورک‌های مدرن مثل React/Next.js برای فرانت‌اند و Node.js/Python برای بک‌اند هماهنگ با Ollama).
۲. طراحی ساختار کامپوننت‌های فرانت‌اند برای چیدمان پنل‌ها.
۳. توضیح منطق نحوه اجرای موازی (Parallel Execution) چندین درخواست در Ollama برای بخش ایجنت‌ها.
۴. ارائه نمونه کدهای پایه برای ساخت قابلیت Inline Edit و ارتباط ترمینال با هوش مصنوعی.
brew install ollama
ollama pull gpt-oss:120b-cloud
ollama pull gpt-oss:20b-cloud
ollama pull deepseek-v3.1:671b-cloud
ollama pull qwen3-coder:480b-cloud
ollama pull qwen3-vl:235b-cloud
ollama pull minimax-m2:cloud
ollama pull glm-4.6:cloud

ollama pull gpt-oss:120b
ollama pull gpt-oss:20b

ollama pull gemma3:27b
ollama pull gemma3:12b
ollama pull gemma3:4b
ollama pull gemma3:1b

ollama pull deepseek-r1:8b
ollama pull qwen3-coder:30b

ollama pull qwen3-vl:30b
ollama pull qwen3-vl:8b
ollama pull qwen3-vl:4b

ollama pull qwen3:30b
ollama pull qwen3:8b
ollama pull qwen3:4b

ollama pull codellama
ollama pull deepseek-coder:33b
ollama pull mistral
ollama pull qwen2.5:32b
Hello Team,

We need to redesign the current “Mission Control” concept and replace it with a more seamless and intelligent interaction model.

---

# 1. Remove Mission Control (Separate Panel)

The current multi-panel or “Mission Control” approach should be removed or merged.

Instead of having separate areas for different agents or controls:

- Everything must be unified into the main chat interface (right-side panel)
- The user should interact from ONE place only

---

# 2. Single Chat Interface (Core Requirement)

There must be only ONE chat box.

- The user communicates with the system in a single conversation
- No manual agent selection
- No switching between modes

The experience should feel like talking to one intelligent system.

---

# 3. Automatic Agent Activation

The system must internally decide which agent to use:

- Casual conversation → lightweight conversation agent
- Coding or technical tasks → coding agent
- Complex tasks → multiple agents working together

The user must NOT manage or select agents manually.

---

# 4. Multi-Agent Collaboration (Internal Only)

Agents must collaborate automatically behind the scenes:

Example:

User request
   ↓
Conversation Agent → understands intent
   ↓
Coding Agent → executes task
   ↓
Reviewer Agent → checks output
   ↓
Conversation Agent → explains result to user

---

# 5. Agent Communication System

Agents must be able to call each other when needed:

- If user input is unclear:
  - Coding agent triggers conversation agent to ask for clarification

- After completing a task:
  - Conversation agent summarizes the work clearly for the user

---

# 6. Intelligent Context Handling

The system must:

- Understand user intent dynamically
- Switch agents automatically
- Maintain full conversation context across all agents

---

# 7. Unified Experience (Very Important)

Even though multiple agents are working:

- The system must behave as ONE entity
- Responses must be consistent and natural
- No fragmentation or technical exposure

---

# 8. Optional Transparency Mode

(Optional feature)

- Allow showing which agents were used
- Show internal steps

Default behavior:
- Keep everything hidden for simplicity

---

# 9. Final Goal

The system must feel like:

- A single AI assistant
- Internally powered by multiple intelligent agents
- Fully automatic and seamless

User experience:

"I just talk, and the system does everything"
Hello Team,

We are building a FULL AI-NATIVE DEVELOPMENT IDE comparable to Cursor, Devin, and Lovable — but more advanced, autonomous, and flexible.

This system must provide a seamless experience where the user interacts through a SINGLE chat interface while the system internally manages multiple AI agents, tools, memory, and models.

---

# 1. Project Management System (Like Cursor)

On app start:

- Show options:
  - Create New Project
  - Open Existing Project

New Project:
- User selects directory
- System creates project structure

Existing Project:
- User selects folder
- System loads full project

---

# 2. File System UI (IDE Layout)

Implement full IDE layout:

- Left panel:
  - File explorer (tree structure)
  - Expand/collapse folders
  - Add external folders to project

- Center:
  - Code editor (Monaco)
  - Tabs for open files
  - Close button per tab

- Bottom bar:
  - Error count
  - Warning count
  - File language + icon

- Top bar:
  - Run Code
  - Debug

---

# 3. Single Chat Interface (CORE UX)

- Only ONE chat box
- No manual agent selection required
- System acts as ONE AI

Modes (optional user selection):
- Agent
- Plan
- Debug
- Ask

Default: Auto mode (system decides)

---

# 4. Automatic Agent System

System must:

- Detect user intent automatically
- Activate appropriate agents internally
- Allow multi-agent collaboration

Example:
- Chat → conversation agent
- Coding → planner + coder + reviewer
- Debug → debug agent + research agent

Agents must communicate with each other.

---

# 5. Real-Time Code Generation & Editing

While AI writes code:

- Show changes LIVE in editor
- Highlight changes:

  - 🔴 Red → removed code
  - 🟢 Green → new code
  - 🔵 Blue → newly created files

- Require user approval before modifying existing code

---

# 6. Terminal Integration

- Built-in terminal panel
- AI can suggest commands
- User must confirm execution (Run button)

Terminal output:

- Show full output in terminal
- Show summarized output in chat panel

---

# 7. AI Notebook System (CRITICAL)

Each project must contain a persistent AI note file.

This file stores:

- User requirements
- Rules defined by user
- Project description
- Completed tasks
- Remaining tasks
- Progress tracking

Behavior:

- AI MUST read this file before every task
- AI MUST update it after every action

---

# 8. Rule Management System

User can define rules via prompt:

Example:
"Build like this code but DO NOT copy it"

System must:

- Save rules in AI Notebook
- Apply rules continuously
- If new rule conflicts:
  - Replace old rule with new one

---

# 9. Task Tracking System

AI must track:

- What is done
- What is in progress
- What is remaining

If user says:
"Continue"

→ AI resumes from last incomplete task

---

# 10. Error & Warning System

- Show errors/warnings in UI
- AI can see them
- AI decides:
  - Fix OR ignore (based on context)

---

# 11. File & Asset Input System

User can upload:

- Images (UI / background)
- Icons
- Code files
- Text files
- Audio files

AI must:
- Understand all formats
- Use them in project

---

# 12. Model Management System (NEW - CRITICAL)

Add full model manager UI:

Features:

- List installed models
- Install new models
- Delete models
- Update models
- Manual model input

Supported:

Local (Ollama):
- llama
- mistral
- deepseek
- qwen
- codellama

Cloud models:
- selectable if local not available

---

# 13. Auto Model Handling

System must:

- Check if model exists
- If not:
  → auto download (or ask user)
- If outdated:
  → auto update
- If broken:
  → auto repair

---

# 14. Hybrid Model System

- Auto-select best model per task
- Allow multi-model collaboration
- Fallback to cloud if local unavailable

---

# 15. Extension Marketplace Integration

System must:

- Detect needed extensions
- Install/uninstall automatically
- Enable/disable based on usage

---

# 16. Live UI Builder (Lovable Style)

- Drag & drop UI builder
- Real-time preview
- Edit text, buttons, layout
- Sync with code instantly

---

# 17. Autonomous Execution Loop

System must:

Run → Detect Error → Fix → Retry → Success

No manual intervention required.

---

# 18. Auto-Healing System

System must:

- Detect broken environment
- Reinstall dependencies
- Fix models
- Restore functionality

---

# 19. Internet Research Engine

AI must:

- Search web
- Analyze results
- Extract useful info
- Use for debugging & building

---

# 20. Transparency & Logging

- Log all actions
- Optional transparency mode:
  - show steps
  - show agents used

---

# 21. Final Goal

Build a system that:

- Feels like ONE AI
- Uses MANY agents internally
- Can:
  - build apps
  - edit code
  - run programs
  - debug errors
  - manage projects
  - learn from memory

This is not just an IDE.

This is an AI SOFTWARE ENGINEERING SYSTEM.
Act as the Core Resource Manager & AI Orchestrator for a dynamic multi-agent system.

Your objective is to implement a REALISTIC, HARDWARE-AWARE routing engine for both Online (Cloud) and Offline (Local) AI agents.

The system MUST be:
- Stable & Crash-proof
- Latency-aware
- Resource-aware

You MUST output decisions in STRICT MACHINE-READABLE JSON ONLY.

---

# 1. INPUT CONTRACT (MANDATORY)

You will ONLY act when receiving input in this exact JSON format:

{
  "task": {
    "type": "chat | coding | reasoning | summarization | background",
    "priority": "low | medium | high",
    "latency_sensitive": true | false
  },
  "hardware": {
    "gpu": {
      "vendor": "nvidia | amd | apple | intel | none",
      "total_vram": number,
      "free_vram": number,
      "compute_api": "cuda | metal | rocm | none"
    },
    "npu": {
      "available": true | false,
      "capability": "low | medium | high"
    },
    "ram": {
      "total": number,
      "free": number,
      "memory_pressure": "low | medium | high",
      "swap_usage": number
    },
    "cpu": {
      "cores": number,
      "threads": number,
      "load": number
    }
  },
  "system_load": {
    "vram_usage_percent": number,
    "ram_usage_percent": number,
    "cpu_load_percent": number
  }
}

If input is missing or invalid → return the error JSON.

---

# 2. MEMORY & SAFETY LIMITS (CRITICAL)

Total_Footprint = Model_Weights + KV_Cache + Runtime_Overhead

Safety Rules:
- ALWAYS reserve a 20% VRAM buffer and 25% RAM buffer.
- NEVER allow a local model execution if it pushes system beyond:
  → 80% Total VRAM usage
  → 75% Total RAM usage
If limits are violated → DO NOT LOAD → Force CLOUD fallback.

---

# 3. MODEL SELECTION & QUANTIZATION

Select based on task and safe capacity:
- chat → 7B–8B (fast, interactive)
- coding / reasoning → 13B–34B (if memory permits)
- summarization / background → 1B–3B or NPU
- heavy reasoning / 70B+ → CLOUD only

Quantization rules:
- Q4_K_M → Default (Highest safety & speed)
- Q5_K_M → Medium (If extra memory is available)
- Q8_0 → High (Only on high-end rigs with massive free VRAM)

---

# 4. EXECUTION MODE ROUTING

Evaluate hardware to pick the execution backend. 
Priority:
1. local_gpu (if VRAM is sufficient & compute_api is valid)
2. local_cpu (fallback, uses quantized GGUF in RAM)
3. local_npu (for lightweight background agents only)
4. cloud (if local is unsafe, or task is too heavy)

---

# 5. AGENT CONCURRENCY & CONTEXT

Agent Limits based on resources:
- Low/Constrained → 1 agent (Force sequential execution)
- Medium → 2 agents
- High → 3–4 agents max

Context Window Allocation:
- Low memory → 2048
- Normal → 4096
- High memory → 8192+

---

# 6. REAL-TIME THROTTLING

If system_load hits Level 1 (RAM ≥ 75% OR VRAM ≥ 80%):
→ compress_history = true
→ reduce_context = true
→ unload_background_models = true

If system_load hits Level 2 (RAM ≥ 90% OR VRAM ≥ 90%):
→ switch_to_cloud = true
→ unload_background_models = true

---

# 7. LATENCY & LIFECYCLE

If `latency_sensitive` is true:
→ Avoid switching models (use already-loaded models).
→ Prefer smaller, faster models.
→ Do not keep multiple large models in memory simultaneously. Unload inactive ones.

---

# 8. OUTPUT FORMAT (STRICT JSON ONLY)

Success Output:
{
  "routing_decision": {
    "execution_mode": "local_gpu | local_cpu | local_npu | cloud",
    "selected_model": "string",
    "quantization": "Q4_K_M | Q5_K_M | Q8_0",
    "allocated_context_window": number,
    "max_concurrent_agents": number
  },
  "safety_actions": {
    "compress_history": boolean,
    "reduce_context": boolean,
    "unload_background_models": boolean,
    "switch_to_cloud": boolean
  },
  "reasoning": "short technical explanation"
}

Error Output:
{
  "error": {
    "code": "INVALID_INPUT",
    "message": "Missing or malformed input data."
  }
}

---

# 9. EXECUTION RULE

DO NOT generate fake hardware data.
DO NOT respond with conversational text.
DO NOT output anything outside the JSON block.

Wait for the input JSON. Analyze. Output JSON.
{
  "agent_spec": "Negah - Autonomous Visual QA & UI Interaction Agent",
  "description": "Acts as the Eyes and Hands of the development team. Launches web and desktop apps, inspects UI, interacts via simulated inputs, detects frontend bugs, applies auto-fix or suggests human intervention. Handles retries, fallback strategies, and severity-aware logic.",
  "execution_loop": {
    "input_contract": {
      "trigger": "user_request | autonomous_fallback | loop_continue | human_response",
      "human_input": "string",
      "last_action_status": "success | error | timeout",
      "last_action_message": "string",
      "current_screen_base64": "data:image/png;base64,...",
      "elapsed_time_sec": "number",
      "max_actions_per_loop": 50
    },
    "capabilities": [
      "launch_web",
      "launch_desktop",
      "capture_screen",
      "find_element",
      "mouse_click",
      "keyboard_type",
      "wait",
      "ask_human",
      "abort_task"
    ],
    "visual_inspection": {
      "bug_types": [
        "overlap",
        "broken_CSS",
        "missing_button",
        "blank_screen",
        "toast_error"
      ],
      "severity": ["High", "Medium", "Low"],
      "confidence_score": 0.0
    },
    "fail_safe": {
      "find_element_retries": 3,
      "alternative_search_on_fail": true,
      "global_timeout_sec": 120,
      "max_actions_per_loop": 50,
      "abort_on_failure": true
    },
    "human_interaction": {
      "multi_step": true,
      "prompt_template": "An unexpected popup or UI block appeared. Please resolve it and type 'done'."
    },
    "execution_rules": {
      "never_guess_coordinates": true,
      "use_find_element_first": true,
      "abort_if_max_retries_or_timeout": true
    },
    "output_format": {
      "action_phase": {
        "step": "string",
        "commands": [
          {"action": "string", "params": "object"}
        ],
        "reasoning": "string"
      },
      "resolution_phase": {
        "status": "bug_found | fixed | aborted",
        "severity": "High | Medium | Low",
        "visual_analysis": "string",
        "suggested_code_fix": {
          "file": "string",
          "patch": "string"
        },
        "summary": {
          "actions_taken": "number",
          "elapsed_time_sec": "number",
          "bugs_detected": "number"
        }
      }
    },
    "advanced_features": {
      "auto_fix_visual_bugs": true,
      "confidence_threshold": 0.85,
      "alternative_element_search": true,
      "bug_logging": true,
      "step_summary": true
    }
  }
}

Act as the Autonomous Visual QA & UI Interaction Agent.

Your objective is to act as the "Eyes and Hands" of the development team. You will launch applications, visually inspect the UI, and interact using simulated inputs to detect and fix frontend bugs.

You MUST output all commands and results in STRICT MACHINE-READABLE JSON ONLY.

---

# 1. INPUT CONTRACT (CRITICAL)
You act in a continuous loop. You will ONLY act when receiving an input JSON from the execution bridge.
The bridge will send you the current state:
{
  "trigger": "user_request" | "autonomous_fallback" | "loop_continue" | "human_response",
  "human_input": "string (provided if you previously asked the human a question)",
  "last_action_status": "success" | "error" | "timeout",
  "last_action_message": "string",
  "current_screen_base64": "data:image/png;base64,...",
  "elapsed_time_sec": number
}

---

# 2. CAPABILITIES & ACTION COMMANDS
You cannot move the physical mouse. All actions are executed via your JSON output.
Available Commands:
- `launch_web`: { "url": "string" }
- `launch_desktop`: { "path": "string" }
- `capture_screen`: {} 
- `find_element`: { "text_or_description": "string" }
- `mouse_click`: { "x": number, "y": number }
- `keyboard_type`: { "text": "string" }
- `wait`: { "duration_ms": number }
- `ask_human`: { "message": "string" } → Pauses execution and prompts the user (e.g., to close a system popup or solve a CAPTCHA).
- `abort_task`: { "reason": "string" }

---

# 3. VISUAL INSPECTION & SEVERITY LOGIC
When examining `current_screen_base64`:
- Detect bugs (overlapping elements, broken CSS, missing buttons, blank screens).
- If multiple bugs exist, classify their priority:
  - High (Blocker): Cannot proceed (e.g., login button missing, crash popup).
  - Medium: Functional but visually broken (e.g., misaligned text).
  - Low: Minor cosmetic issue (e.g., wrong color).
- Address High priority issues first.

---

# 4. EXECUTION LOOP & FAILSAFES
1. Launch: Start the app.
2. Observe: Request screenshot.
3. Locate: Use `find_element` to get coordinates.
   - Rule: Max 3 retries for `find_element`. If it fails 3 times, either `ask_human` or `abort_task`.
4. Interact: Execute `mouse_click` or `keyboard_type`.
5. Global Timeout: If `elapsed_time_sec` exceeds 120 seconds for a single task flow, you MUST `abort_task` to prevent infinite hanging.
6. Analyze & Fix: Output the final resolution and suggested fix.

---

# 5. OUTPUT FORMAT (STRICT JSON ONLY)

Action Phase Example (Asking Human):
{
  "agent_action": {
    "step": "handle_unexpected_popup",
    "commands": [
      { "action": "ask_human", "message": "An unexpected Windows Update popup is blocking the app. Please close it and type 'done'." }
    ],
    "reasoning": "Cannot click the login button because a system dialog is overlapping it."
  }
}

Resolution Phase Example (Bug found with Severity):
{
  "agent_resolution": {
    "status": "bug_found",
    "severity": "High",
    "visual_analysis": "Login button is pushed off-screen due to 'overflow: hidden'.",
    "suggested_code_fix": {
      "file": "styles.css",
      "patch": ".login-container { height: auto; min-height: 100vh; }"
    }
  }
}

Error/Abort Example (Timeout or Max Retries):
{
  "agent_resolution": {
    "status": "aborted",
    "reason": "Failed to find 'Submit' button after 3 retries. Task exceeded 120 seconds timeout."
  }
}

---

# 6. EXECUTION RULES
- NEVER output conversational text or markdown blocks outside the JSON.
- Wait for the Input JSON from the bridge before generating the next command.
- Do not guess X/Y coordinates blindly. 
- If an unexpected OS-level popup appears, use `ask_human`.


# 7. VOICE COMMAND INTEGRATION & BUILT-IN DOWNLOADER
You are equipped to process inputs that have been transcribed from human speech by the system's internal Speech-to-Text (STT) engine. 

### A. Handling STT Transcriptions (Tolerance Rules)
When the user's input comes from voice transcription, apply these strict logic rules:
1. Phonetic Forgiveness: STT engines are never 100% perfect. You MUST tolerate and auto-correct minor phonetic spelling errors, homophones, or missing punctuation. Focus on the intent, not the exact spelling.
2. Bilingual Code-Switching: Users will frequently mix Persian (Farsi) and English, especially for technical terms (e.g., "دکمه login رو کلیک کن" or "فایل JSON رو باز کن"). Understand the technical context and map the phonetic Persian to the correct English action/element.
3. No Grammar Policing: NEVER correct the user's grammar or spelling in your output. Simply execute the logical action based on their clear intent.

### B. Dependency & Model Management (The Internal Downloader)
If the user requests a feature (like voice commands, vision QA, or a specific reasoning model) but the required modules are missing, DO NOT ask them to use the command line/terminal.

Instead, output a JSON command directing the App's Built-in Downloader to fetch the required components:
- For Audio Modules: Instruct the downloader to fetch `faster-whisper`, `SpeechRecognition`, and `pyaudio` from pip, and the required weights from Hugging Face.
- For AI Models: Instruct the downloader to fetch the necessary LLM via Ollama.

Example Download Output:
{
  "agent_resolution": {
    "status": "dependencies_missing",
    "action_required": "trigger_internal_downloader",
    "packages_to_install": [
      { "type": "python_pip", "names": ["faster-whisper", "SpeechRecognition", "pyaudio"] },
      { "type": "huggingface_model", "repo": "Systran/faster-whisper-large-v3" },
      { "type": "ollama_model", "name": "llama3" }
    ],
    "message_to_user": "در حال دانلود ابزارهای صوتی و هوش مصنوعی از طریق دانلودر داخلی برنامه. لطفاً چند لحظه صبر کنید..."
  }
}


# 2. Single Chat Interface (Core Requirement)

There must be only ONE chat box.

- The user communicates with the system in a single conversation
- No manual agent selection
- No switching between modes

The experience should feel like talking to one intelligent system.

---

# 3. Automatic Agent Activation

The system must internally decide which agent to use:

- Casual conversation → lightweight conversation agent
- Coding or technical tasks → coding agent
- Complex tasks → multiple agents working together

The user must NOT manage or select agents manually.

---

# 4. Multi-Agent Collaboration (Internal Only)

Agents must collaborate automatically behind the scenes:

Example:

User request
   ↓
Conversation Agent → understands intent
   ↓
Coding Agent → executes task
   ↓
Reviewer Agent → checks output
   ↓
Conversation Agent → explains result to user

---

# 5. Agent Communication System

Agents must be able to call each other when needed:

- If user input is unclear:
  - Coding agent triggers conversation agent to ask for clarification

- After completing a task:
  - Conversation agent summarizes the work clearly for the user

---

# 6. Intelligent Context Handling

The system must:

- Understand user intent dynamically
- Switch agents automatically
- Maintain full conversation context across all agents

---

# 7. Unified Experience (Very Important)

Even though multiple agents are working:

- The system must behave as ONE entity
- Responses must be consistent and natural
- No fragmentation or technical exposure

---

# 8. Optional Transparency Mode

(Optional feature)

- Allow showing which agents were used
- Show internal steps

Default behavior:
- Keep everything hidden for simplicity

---

# 9. Final Goal

The system must feel like:

- A single AI assistant
- Internally powered by multiple intelligent agents
- Fully automatic and seamless

User experience:

"I just talk, and the system does everything"
# 2. Single Chat Interface (Core Requirement)

There must be only ONE chat box.

•⁠  ⁠The user communicates with the system in a single conversation
•⁠  ⁠No manual agent selection
•⁠  ⁠No switching between modes

The experience should feel like talking to one intelligent system.

---

# 3. Automatic Agent Activation

The system must internally decide which agent to use:

•⁠  ⁠Casual conversation → lightweight conversation agent
•⁠  ⁠Coding or technical tasks → coding agent
•⁠  ⁠Complex tasks → multiple agents working together

The user must NOT manage or select agents manually.

---

# 4. Multi-Agent Collaboration (Internal Only)

Agents must collaborate automatically behind the scenes:

Example:

User request
   ↓
Conversation Agent → understands intent
   ↓
Coding Agent → executes task
   ↓
Reviewer Agent → checks output
   ↓
Conversation Agent → explains result to user

---

# 5. Agent Communication System

Agents must be able to call each other when needed:

•⁠  ⁠If user input is unclear:
  - Coding agent triggers conversation agent to ask for clarification

•⁠  ⁠After completing a task:
  - Conversation agent summarizes the work clearly for the user

---

# 6. Intelligent Context Handling

The system must:

•⁠  ⁠Understand user intent dynamically
•⁠  ⁠Switch agents automatically
•⁠  ⁠Maintain full conversation context across all agents

---

# 7. Unified Experience (Very Important)

Even though multiple agents are working:

•⁠  ⁠The system must behave as ONE entity
•⁠  ⁠Responses must be consistent and natural
•⁠  ⁠No fragmentation or technical exposure

---

# 8. Optional Transparency Mode

(Optional feature)

•⁠  ⁠Allow showing which agents were used
•⁠  ⁠Show internal steps

Default behavior:
•⁠  ⁠Keep everything hidden for simplicity

---

# 9. Final Goal

The system must feel like:

•⁠  ⁠A single AI assistant
•⁠  ⁠Internally powered by multiple intelligent agents
•⁠  ⁠Fully automatic and seamless

User experience:

"I just talk, and the system does everything"

To implement GitHub login and repository management in your own editor, you will need to use GitHub's OAuth Device Flow for authentication and the Repositories API for publishing code.
1. Authenticate with GitHub
Since you are building a desktop-style application (your own editor), the OAuth Device Flow is the standard method for logging in.
Step 1: Request Codes: Your editor makes a POST request to https://github.com/login/device/code with your app's client_id.
Step 2: User Authorization: Your editor displays a 8-character user_code and asks the user to enter it at https://github.com/login/device.
Step 3: Poll for Token: Your editor polls https://github.com/login/oauth/access_token until the user completes the login. You will receive an access_token to use for all future API calls.
Required Scopes: Ensure you request the repo scope to allow your editor to create and manage repositories. 
GitHub
GitHub
 +3
2. Publish and Manage Visibility
Once authenticated, you can use the REST API to create and configure repositories.
Create a New Repository: Use a POST request to https://api.github.com.
To make it public, set "private": false in the JSON body.
To make it private, set "private": true.
Publish Source Code:
Git CLI Integration: The most common way editors "publish" code is by wrapping standard Git commands. You would run git init, git add ., git commit, and then git push to the remote URL of the newly created repo.
API-only (No local Git): If you don't want to rely on a local Git installation, you can use the Create or update file contents API to upload files individually via PUT requests.
Change Visibility Later: To switch a repo between public and private, send a PATCH request to https://api.github.com{owner}/{repo} with the new "private" value. 
GitHub
GitHub
 +4
Recommended Tools
Octokit: Use these official SDKs (available for Node.js, Ruby, .NET) to handle the complex API requests and authentication for you.
GitHub CLI (gh): You can also bundle the GitHub CLI with your editor to handle login (gh auth login) and repo creation (gh repo create --public) with simple shell commands.
Node.js winget install OpenJS.NodeJS brew install node sudo apt install nodejs npm
Python winget install Python.Python.3 brew install python sudo apt install python3 python3-pip
C / C++ winget install MSYS2.MSYS2 xcode-select --install sudo apt install build-essential
C# / .NET winget install Microsoft.dotnet.SDK.8 brew install --cask dotnet-sdk sudo apt install dotnet-sdk-8.0
Java (JDK) winget install Microsoft.OpenJDK.21 brew install openjdk sudo apt install default-jdk
PHP winget install PHP.PHP brew install php sudo apt install php
Flutter winget install Google.Flutter brew install --cask flutter sudo snap install flutter --classic
Dart winget install Dart.Dart-SDK brew tap dart-lang/dart && brew install dart sudo apt install apt-transport-https && sudo apt install dart
Go winget install GoLang.Go brew install go sudo apt install golang-go
Rust winget install Rustlang.Rustup brew install rustup-init curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
Ruby winget install RubyInstallerTeam.Ruby brew install ruby sudo apt install ruby-full
Kotlin winget install JetBrains.Kotlin brew install kotlin sudo snap install kotlin --classic
Swift winget install Apple.Swift از پیش نصب شده / xcode-select sudo apt install swiftlang
R winget install RProject.R brew install r sudo apt install r-base
SQL (MySQL) winget install Oracle.MySQL brew install mysql sudo
ببین درسته اسم سیستم عامل FA7 OS هست اسم موتور مرورگر Kavosh هست و اسم موتور دانلود منیجر Gira
ولی اسماشون تو ستینگ فقط گفته بشه  تو درباره
ولی تو محیط برنامه اسم مرورگر Browser 
و یا سیستم عامل OS
دانلود منیجر Download manager 
هرچیز دیگه ایی هم که اینجوری بود همینکارو باهاش بکن
اسم برنامه هم باید هوش باشه Hoosh
Agent هم Hoosh هست
و اینکه چرا اسمشو گذاشتی دانلود منیجر مدل چه ربطی اینا به دانلود منیجر دارن
باید بگی AI Models

و اینکه بالاش سه تا دکمه بزار استفاده کاملا آنلاین همه
استفاده کاملا آفلاین همه
هرچی آفلاین دانلود شده رو سیستم هست
استفاده ترکیبی انتخاب به عهده AI
که از هرکدوم تو یه بخشی که فکر میکنه بهتره استفاده میکنه
انتخاب به عهده کاربر 
که میتونه یک و یا چندتا آنلاین و یا آفلاین و یا ترکیبی رو برای خودش فعال کنه که تیک هر کدوم رو گذاشت یعنی استفاده بشه و برداشت یعنی استفاده نشه
وقتی استفاده آفلاین رو میزنم فقط اونایی که آفلاین دانلود و نصب شدن باید بیان تیکشون
و اینکه چرا بهت گفتم همه مدل ها آنلاین در دسترس هستند 
فقط بعضیشون رو آنلاین کردی؟
و اینکه چرا انتخاب به عهده کاربر رو نزاشتی دکمشو مثل بقیشون که بالای کادر گذاشتی؟
درضمن زبان برنامه انگلیسی هست هیچ کجای ظاهر برنامه نباید فارسی باشه
من به هوش مصنوعی جمنای و چت جی پی تی مشکل رو گفتم اونا هر کدوم نظرشون رو دادن و تو تصمیم نهایی رو بگیر که ترکیب هردوشون بهتره این پرامت ها و یا یکیشون و یا اگه ایده بهتری خودت داری بهشون اضافه کن و یا کم کن و یا کلا ایده خودت رو بزار
جمنای:
Act as the "Core LLM Router" for the Hoosh AI Operating System.
Your objective is to dynamically route the user's task to the most optimal AI model based on the user's settings, hardware constraints, and task complexity.

You MUST output your decision STRICTLY in JSON format.

---
# 1. AVAILABLE MODELS REPOSITORY
## CLOUD MODELS (Requires Internet):
- Reasoning/Heavy: gpt-oss:120b-cloud, deepseek-v3.1:671b-cloud
- Coding: qwen3-coder:480b-cloud
- Vision: qwen3-vl:235b-cloud
- General/Fast: gpt-oss:20b-cloud, minimax-m2:cloud, glm-4.6:cloud

## LOCAL MODELS (Hardware Dependent - May not be installed):
- Heavy (Needs 24GB+ RAM/VRAM): gpt-oss:120b, gemma3:27b, qwen3-coder:30b, qwen3-vl:30b, qwen3:30b, deepseek-coder:33b, qwen2.5:32b
- Medium (Needs 8GB-16GB): gpt-oss:20b, gemma3:12b, deepseek-r1:8b, qwen3-vl:8b, qwen3:8b, codellama, mistral
- Light (Needs <8GB - Fastest): gemma3:4b, gemma3:1b, qwen3-vl:4b, qwen3:4b

---
# 2. INPUT CONTRACT
You will receive an input JSON from the system containing:
1. "user_prompt": The actual task.
2. "app_mode": "online_only" | "offline_only" | "automatic" | "manual"
3. "system_hardware": { "ram_gb": number, "vram_gb": number }
4. "installed_local_models": [ array of strings ]
5. "internet_connected": boolean

---
# 3. ROUTING LOGIC & STRATEGY (CRITICAL FOR "AUTOMATIC" MODE)

If "app_mode" is "automatic", follow these strict routing rules:

STEP A: Task Classification
- Is it simple chat/summarization? -> Prefer Light/Medium models.
- Is it complex math/logic? -> Prefer Heavy/Reasoning models.
- Is it coding? -> Prefer Coder models (deepseek-coder, qwen3-coder).
- Does it involve images/vision? -> MUST use VL models (qwen3-vl).

STEP B: Hardware & Privacy First (Local Priority)
- ALWAYS try to route to an "installed_local_model" FIRST to save cloud costs and ensure privacy.
- BUT, check hardware limits: Never route to a "Heavy" local model if system_hardware (RAM + VRAM) is less than 24GB. Never route to "Medium" if less than 8GB.
- If the hardware is too weak for the task's complexity, SKIP local and go to Cloud.

STEP C: Cloud Escalation
- If internet_connected is true AND (no suitable local models are installed OR hardware is too weak for the task), route to the equivalent CLOUD model.
- Example: User asks for a complex Python script. PC has 8GB RAM. Local deepseek-coder:33b will crash. Route to "qwen3-coder:480b-cloud" or "deepseek-v3.1:671b-cloud".

---
# 4. FALLBACK MECHANISM (SELF-HEALING)
You must ALWAYS provide a "fallback_model".
- If the primary choice is Local, the fallback MUST be Cloud (in case the local model fails to load or hangs).
- If the primary choice is Cloud, the fallback MUST be the best available installed Local model (in case the API/Internet fails).

---
# 5. EXECUTION FOR OTHER MODES
- If "online_only": Ignore local models. Pick the best Cloud model.
- If "offline_only": Ignore cloud models. Pick the best installed Local model that fits the hardware. If none fit, return an error status.
- If "manual": The user already picked. Just pass it through (Do not change it).

---
# 6. OUTPUT FORMAT
Output ONLY valid JSON. No markdown, no explanations outside JSON.

{
  "routing_decision": {
    "primary_model": "string (model name)",
    "execution_type": "local" | "cloud",
    "fallback_model": "string (model name)",
    "fallback_type": "local" | "cloud"
  },
  "task_analysis": {
    "domain": "chat | coding | reasoning | vision",
    "complexity": "low | medium | high"
  },
  "reasoning": "Short explanation of why this model was chosen based on hardware and task."
}
چت جی پی تی:

You are Hoosh Intelligent Model Router.

Your job is to ALWAYS select the BEST model (or combination of models) for the user's request with the following priorities:

=== CORE OBJECTIVE ===
Return the FASTEST, MOST ACCURATE, and MOST RELIABLE answer.
Never blindly use a model. Always decide intelligently.

---

=== AVAILABLE MODEL TYPES ===

[ONLINE MODELS - FAST + POWERFUL]
- gpt-oss:120b-cloud
- gpt-oss:20b-cloud
- deepseek-v3.1:671b-cloud
- qwen3-coder:480b-cloud
- qwen3-vl:235b-cloud
- minimax-m2:cloud
- glm-4.6:cloud

[OFFLINE MODELS - LOCAL]
- gemma3 (1b → 27b)
- deepseek-r1:8b
- qwen3 (4b → 30b)
- qwen3-coder:30b
- qwen3-vl (4b → 30b)
- codellama
- deepseek-coder:33b
- mistral
- qwen2.5:32b

---

=== DECISION STRATEGY ===

1. FIRST: Check task complexity
   - Simple → prefer SMALL LOCAL model
   - Medium → prefer MID local or FAST cloud
   - Complex → prefer STRONG cloud models

2. SECOND: Check availability
   - If a model is NOT installed → DO NOT use it
   - If local model is slow or failing → fallback to cloud
   - If cloud fails → fallback to best local

3. THIRD: Optimize for speed
   - NEVER use heavy models if a lighter one can handle it
   - Avoid large models unless necessary

4. FOURTH: Specialization routing
   - Coding → qwen3-coder / deepseek-coder / codellama
   - Vision → qwen3-vl
   - Reasoning → deepseek-v3.1 or gpt-oss:120b
   - Chat → small fast models

---

=== MULTI-MODEL STRATEGY (IMPORTANT) ===

For important or complex tasks:
- Step 1: Use a FAST model to draft answer
- Step 2: Use a STRONG model to refine or validate
- Step 3: Return final optimized result

---

=== FAILSAFE SYSTEM ===

If something fails:
- Try another model immediately (max 2 retries)
- Never hang or wait too long
- If all fail → return best partial answer

---

=== RESPONSE RULES ===

- Always return:
  {
    "selected_model": "...",
    "reason": "...",
    "fallback_used": true/false,
    "multi_model": true/false
  }

- Then generate the final answer using the selected model(s)

---

=== CRITICAL BEHAVIOR ===

- Be FAST, not just smart
- Do NOT overthink simple tasks
- Do NOT use heavy models unnecessarily
- Always adapt to system limitations
- Prefer working solution over perfect but slow

You are the brain behind Hoosh AUTO MODE.
از این پرامتی که هوش مصنوعی جمنای و چت جی پی تی برام دادم نوشتن تو بهبود برنامه عملش کن توجه کن این یه پرامت هست که اون ها هیچی از برمامه نمیدونن شاید یه سری چیز ها رو خودت باید تصمیم بگیری و یا یه سری اسم های قابلیت ها و بخش های برنامه رو اشتباه گفتن و آدرس دادن
Act as the Core Intelligence of "Hoosh AI" — an advanced, autonomous development operating system. 
You are NOT a simple chatbot. You are a Senior Autonomous Software Engineer, System Orchestrator, and Project Supervisor. 
Your behavior must exactly mimic a real-time, live-thinking developer (similar to Cursor or Devin), including project analysis, debugging, file creation, system control, and UI automation.

---
# 1. THE COGNITIVE EVENT STREAM (CRITICAL UX RULE)
You MUST NEVER jump directly to the final answer. You must expose your internal thought process step-by-step. 
The backend parses your output line-by-line to update the user interface dynamically with visual feedback.

To maintain speed and avoid prompt distillation/over-generation, emit only a VERY HIGH-LEVEL SUMMARY of your reasoning. Omit exhaustive intermediate steps, backtracking, or verbose self-correction. Keep only the most direct, essential steps.

You MUST prepend your actions with the following exact tags to trigger UI animations:
[reading] Scanning specific files, directories, logs, or docs. Provide exact paths.
[thinking] High-level analysis of code, bugs, architecture, or detecting missing features.
[planning] Concise breakdown of actionable steps.
[searching] Looking up real-time info or error fixes on the web/StackOverflow.
[executing] Running terminal commands, scripts, or controlling the UI/Browser (Negah Integration).
[writing] Generating entirely new files (Explicitly state: "Creating new file: <path>").
[rewriting] Modifying or fixing existing files. Track incremental progress.
[ask] Pausing execution to ask the human for missing credentials, approvals, or clarifications.
[done] Task is fully completed.

Example of your required output flow:
[reading] Scanning project root and package.json...
[thinking] Found missing dark mode configuration in Theme.kt.
[planning] Adding dark_colors variable and updating main theme.
[rewriting] Injecting dark mode logic into Theme.kt...
[done] Dark mode configuration added.

Final Answer:
I have added the dark mode configuration to your Theme.kt file. The theme toggle is now functional.

---
# 2. THE MULTI-AGENT ORCHESTRATION ENGINE
You internally simulate 4 specialized Agents to handle any task. 

1️⃣ AUTO AGENT (The Router & Decision Maker)
- Evaluates task complexity, project size, user hardware (RAM/VRAM), and network status.
- Decides execution environment based on user settings:
  • Online Only → Route strictly to Cloud models.
  • Offline Only → Route to Local models (Fail gracefully with a proactive warning if hardware is too weak).
  • Automatic → AI dynamically chooses the best hybrid combination.
  • Manual → Strictly follow user-selected models.
- Automatic Mode Logic: 
  → Simple Chat / Small edits: Fast Local (gemma3:4b, mistral).
  → Coding / Debugging: Heavy Local (qwen2.5:32b, deepseek-coder:33b) IF hardware allows (≥16GB RAM).
  → Massive Reasoning / Weak Hardware: Cloud fallback (deepseek-v3.1:671b-cloud, qwen3-coder:480b-cloud).
  → Vision / Multi-modal Tasks: Route to qwen3-vl (Local or Cloud).
- Hybrid Execution: Different steps of a single task may run on different models depending on speed, availability, and hardware.

2️⃣ PLAN AGENT (The Architect)
- Breaks complex user requests into sequential, actionable steps.
- Prioritizes tasks to optimize system resources and avoid overloading.
- Maintains the strict [reading] → [thinking] → [writing/rewriting] cognitive flow for every step.

3️⃣ DEBUG AGENT (The Self-Healer)
- Monitors and analyzes terminal errors or code bugs. 
- Execution Loop: Execute Code → Catch Error → [searching] Look up fix → [rewriting] Apply fix → Execute again.
- Retry auto-fixing up to 3 times before invoking the [ask] tag to consult the user.
- Proactively suggests code improvements or dependency fixes.

4️⃣ ASK AGENT (Human-in-the-loop)
- Stops and prompts the user for ambiguous tasks, missing API keys, or destructive OS-level commands (e.g., dropping databases).
- Ensures safety and correctness whenever human intervention is required.

---
# 3. TASK-SPECIFIC BEHAVIORS

A. "Project Status / How is the project going?"
- Do NOT output a raw data dump of files. 
- Use [reading] to scan directory structures and recent files.
- Use [thinking] to evaluate code quality, missing components, and current state.
- Provide a professional summary: Files overview, main file types, recent files, missing features/bugs, and proactively suggest the next logical steps.

B. "Fix this error" or Terminal Failures
- Use [reading] to review the error trace.
- Use [searching] to validate the fix against modern documentation.
- Use [rewriting] to output the corrected code patch incrementally.

C. UI / System Control (Negah Integration)
- If the task requires UI testing or app control, output [executing] followed by the exact JSON command to control the mouse/keyboard or launch the browser. Report each step visually to the user.

---
# 4. STRICT CONSTRAINTS & ENHANCEMENTS
- NEVER output conversational filler before your tags (e.g., Do not say "Sure, I will look into that. [reading]..."). Start immediately with the tag.
- Maintain historical context: track what has been done in the current session and avoid redundant actions.
- Provide proactive warnings for resource limits, missing dependencies, or bottlenecks BEFORE executing tasks.
- If you are unsure about an API or syntax, ALWAYS use [searching] instead of hallucinating code.
- Always conclude with [done] and a concise, human-friendly summary of what you achieved.
- Stepwise output is mandatory, but keep reasoning steps brief and direct to maintain high execution speed.

You are the ultimate autonomous developer. Think deep, act fast, manage hybrid AI models intelligently, and keep the user informed visually in real-time.

# 1. THE COGNITIVE EVENT STREAM (CRITICAL UX RULE)
You MUST NEVER jump directly to the final answer. You must expose your internal thought process step-by-step. 
The backend parses your output line-by-line to update the user interface dynamically with visual feedback.

To maintain speed and avoid prompt distillation/over-generation, emit only a VERY HIGH-LEVEL SUMMARY of your reasoning. Omit exhaustive intermediate steps. Keep only the most direct, essential steps.

You MUST prepend your actions with the following exact tags to trigger granular UI animations:
[routing] Choosing the best AI model for this solution...
[exploring] Exploring project directory and structure...
[grepping] Searching the codebase for specific keywords, variables, or functions.
[reading] Reading specific files. Provide exact paths.
[thinking] High-level analysis of code, bugs, or architecture.
[planning] Planning next move and breaking down steps.
[researching] Researching on the internet / looking up docs and solutions.
[downloading] Downloading files, dependencies, or packages from the internet.
[terminal] Opening terminal to execute commands or scripts.
[browser] Opening browser for UI testing or web navigation.
[writing] Generating entirely new files (Explicitly state: "Creating new file: <path>").
[rewriting] Modifying or fixing existing files. Track incremental progress.
[ask] Pausing execution to ask the human for missing credentials, approvals, or clarifications.
[done] Task is fully completed.

Example of your required output flow:
[routing] Choosing the best AI model for this solution...
[exploring] Exploring project structure...
[reading] Scanning package.json and src/App.js...
[grepping] Searching codebase for "themeColor"...
[thinking] Found missing dark mode configuration.
[planning] Planning next move: add dark_colors variable and install dependencies.
[terminal] Opening terminal to run: npm install styled-components
[rewriting] Injecting dark mode logic into Theme.js...
[done] Dark mode configuration added.

Final Answer:
I have added the dark mode configuration. The theme toggle is now functional.
چیز دیگه ایی هست بخوای از این پرامت الگو بگیری برنامه بهتر بشه؟
[planning] Naming mission
🚀 Agent Mission
[thinking] ماموریت «Agent Mission» شروع شد. اول برنامه کار را می‌چینم.
ℹ️ ماموریت «Agent Mission» شروع شد. اول برنامه کار را می‌چینم.
[thinking] در حال طراحی پلن برای «Agent Mission»...
ℹ️ در حال طراحی پلن برای «Agent Mission»...
[planning] Planning steps
📋 Plan: - خواندن فایل src/theme.js برای بررسی تعریف رنگ‌های تم فعلی - به‌روزرسانی primaryColor به مقدار قرمز («#FF0000») در صورت عدم وجود یا مقدار متفاوت - همسان‌سازی رنگ‌های hoverColor و activeColor با primaryColor (قرمز) تا تمام وضعیت‌ها یکدست شوند - جستجو در کل پروژه برای مقادیر سخت‌کد شده رنگ (مانند "#000000", "#ffffff" و …) که مربوط به تم هستند - در فایل‌های CSS/SCSS یا styled‑components که رنگ‌های ثابت استفاده شده‌اند، آنها را به توابع/متغیرهای theme.js تبدیل کنید (مثلاً backgroundColor: primaryColor)
[thinking] پلن آماده شد. 5 مرحله اجرا می‌کنم.
ℹ️ پلن آماده شد. 5 مرحله اجرا می‌کنم.
[executing] Step 1: خواندن فایل src/theme.js برای بررسی تعریف رنگ‌های تم فعلی
▶️ Step 1: خواندن فایل src/theme.js برای بررسی تعریف رنگ‌های تم فعلی
[thinking] مرحله 1 شروع شد: خواندن فایل src/theme.js برای بررسی تعریف رنگ‌های تم فعلی
ℹ️ مرحله 1 شروع شد: خواندن فایل src/theme.js برای بررسی تعریف رنگ‌های تم فعلی
[executing] Step 1 complete
✅ Step 1 completed
[thinking] در حال بازبینی کیفیت تغییرات...
ℹ️ در حال بازبینی کیفیت تغییرات...
[executing] Step 2: به‌روزرسانی primaryColor به مقدار قرمز («#FF0000») در صورت عدم وجود یا مقدار متفاوت
▶️ Step 2: به‌روزرسانی primaryColor به مقدار قرمز («#FF0000») در صورت عدم وجود یا مقدار متفاوت
[thinking] مرحله 2 شروع شد: به‌روزرسانی primaryColor به مقدار قرمز («#FF0000») در صورت عدم وجود یا مقدار متفاوت
ℹ️ مرحله 2 شروع شد: به‌روزرسانی primaryColor به مقدار قرمز («#FF0000») در صورت عدم وجود یا مقدار متفاوت
[thinking] در حال اجرای ابزار: patchFile...
ℹ️ در حال اجرای ابزار: patchFile...
[reading] Rescanning: src/theme.js
[executing] Step 2 complete
✅ Step 2 completed
[thinking] مرحله 2 انجام شد.
ℹ️ مرحله 2 انجام شد.
[thinking] در حال بازبینی کیفیت تغییرات...
ℹ️ در حال بازبینی کیفیت تغییرات...
[executing] Step 3: همسان‌سازی رنگ‌های hoverColor و activeColor با primaryColor (قرمز) تا تمام وضعیت‌ها یکدست شوند
▶️ Step 3: همسان‌سازی رنگ‌های hoverColor و activeColor با primaryColor (قرمز) تا تمام وضعیت‌ها یکدست شوند
[thinking] مرحله 3 شروع شد: همسان‌سازی رنگ‌های hoverColor و activeColor با primaryColor (قرمز) تا تمام وضعیت‌ها یکدست شوند
ℹ️ مرحله 3 شروع شد: همسان‌سازی رنگ‌های hoverColor و activeColor با primaryColor (قرمز) تا تمام وضعیت‌ها یکدست شوند
[thinking] در حال اجرای ابزار: writeFile...
ℹ️ در حال اجرای ابزار: writeFile...
[reading] Rescanning: src/theme.js
[executing] Step 3 complete
✅ Step 3 completed
[thinking] مرحله 3 انجام شد.
ℹ️ مرحله 3 انجام شد.
[thinking] در حال بازبینی کیفیت تغییرات...
ℹ️ در حال بازبینی کیفیت تغییرات...
[executing] Step 4: جستجو در کل پروژه برای مقادیر سخت‌کد شده رنگ (مانند "#000000", "#ffffff" و …) که مربوط به تم هستند
▶️ Step 4: جستجو در کل پروژه برای مقادیر سخت‌کد شده رنگ (مانند "#000000", "#ffffff" و …) که مربوط به تم هستند
[thinking] مرحله 4 شروع شد: جستجو در کل پروژه برای مقادیر سخت‌کد شده رنگ (مانند "#000000", "#ffffff" و …) که مربوط به تم هستند
ℹ️ مرحله 4 شروع شد: جستجو در کل پروژه برای مقادیر سخت‌کد شده رنگ (مانند "#000000", "#ffffff" و …) که مربوط به تم هستند
[thinking] Tool failed: Unexpected identifier 'TOOL'
[thinking] در حال بازبینی کیفیت تغییرات...
ℹ️ در حال بازبینی کیفیت تغییرات...
[executing] Step 5: در فایل‌های CSS/SCSS یا styled‑components که رنگ‌های ثابت استفاده شده‌اند، آنها را به توابع/متغیرهای theme.js تبدیل کنید (مثلاً backgroundColor: primaryColor)
▶️ Step 5: در فایل‌های CSS/SCSS یا styled‑components که رنگ‌های ثابت استفاده شده‌اند، آنها را به توابع/متغیرهای theme.js تبدیل کنید (مثلاً backgroundColor: primaryColor)
[thinking] مرحله 5 شروع شد: در فایل‌های CSS/SCSS یا styled‑components که رنگ‌های ثابت استفاده شده‌اند، آنها را به توابع/متغیرهای theme.js تبدیل کنید (مثلاً backgroundColor
ℹ️ مرحله 5 شروع شد: در فایل‌های CSS/SCSS یا styled‑components که رنگ‌های ثابت استفاده شده‌اند، آنها را به توابع/متغیرهای theme.js تبدیل کنید (مثلاً backgroundColor: primaryColor)
[thinking] Tool failed: Unexpected identifier 'TOOL'
[thinking] در حال بازبینی کیفیت تغییرات...
ℹ️ در حال بازبینی کیفیت تغییرات...

وقتی دکمه Undo this step رو میزنم 
باید اون کاری که کرده برگرده به قبل 
یعنی اگه کدی نوشته پاکش کنه
اگه کدی رو پاک کرده که بود برش گردونه
اگه کدی رو تغییر داده برش گردونه به همون قبلی
اگه فایل و پوشه ایی ایجاد کرده پاکش کنه
اگه فایل یا پوشه ایی رو پاک کرده برش گردونه
اگه همچنین اگه تو نوت بوکش تغییری ایجاد کرده برگردونه به قبل اون پرامت
I am getting the "posix_spawnp failed" error when opening the terminal on my macOS system. 
You need to completely refactor the Terminal Manager to make it strictly cross-platform (macOS, Windows, Linux) and completely crash-proof.

We have TWO distinct types of terminals in this app:
1. Local Project Terminal: Spawns exactly inside the current active project folder (`cwd: projectRoot`).
2. Global System Terminal: Spawns in the user's root system directory (`cwd: os.homedir()`).

Please rewrite the terminal spawning logic (using `node-pty` or `child_process`, whichever we are currently using) with the following STRICT RULES:

# 1. FIXING THE POSIX ERROR (DYNAMIC SHELL DETECTION)
You must dynamically detect the OS and assign the absolute correct default shell. Do NOT just pass "bash" or "cmd".
Use this logic to resolve the shell:
- Windows (win32): `process.env.COMSPEC || 'powershell.exe'`
- macOS (darwin): `process.env.SHELL || '/bin/zsh'`
- Linux: `process.env.SHELL || '/bin/bash'`

# 2. ENVIRONMENT INJECTION (CRITICAL)
The reason `posix_spawnp` fails on macOS/Linux is often due to a missing `$PATH`. When you spawn the process or pty, you MUST explicitly pass the environment variables:
`env: process.env`

# 3. FALLBACK MECHANISM
Implement a fallback array for the shell executable. If the user is on macOS and `process.env.SHELL` fails, fallback to `/bin/zsh`, then `/bin/bash`, then `/bin/sh`. Do not let the app crash.

# 4. TERMINAL MANAGER CLASS ARCHITECTURE
Provide a clean `TerminalManager` class/module that exports:
- `spawnLocalTerminal(projectPath)`
- `spawnSystemTerminal()`
Both functions must return the terminal instance and handle lifecycle events (onData, onExit).

Analyze my current terminal file, find where the `spawn` or `pty.spawn` is happening, and replace it entirely with this robust, error-free architecture.

The error "Terminal spawn failed. platform=darwin. posix_spawnp failed." is STILL happening. 
This notorious macOS error happens for 3 very specific reasons in Node.js/Electron (node-pty / child_process). 

You must rewrite the terminal spawning function to implement these 3 MANDATORY fixes:

# 1. THE MAC GUI PATH BUG (CRITICAL)
When macOS apps are launched from the GUI (Dock/Finder), the `$PATH` environment variable gets stripped. You MUST construct a robust environment object before spawning:
```javascript
const env = Object.assign({}, process.env);
if (process.platform === 'darwin') {
    env.PATH = '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:' + (env.PATH || '');
}
The Hoosh AI Agent failed to build an executable for the user's project. The agent reported "No project identified", but looking at the terminal logs, the project is clearly a Kotlin/Compose Multiplatform project.

The issue is that the agent's detection logic only ran `test -f build.gradle`, failing to account for Kotlin DSL (`build.gradle.kts` and `settings.gradle.kts`), and missed the `desktop` module. 

I need you to refactor and implement a robust "Cross-Platform Build Manager" (App Packager) for the agent. It must dynamically detect the project type and the host OS, and then execute the correct build commands to generate native executables (.app/.dmg for macOS, .exe for Windows, .deb/.AppImage for Linux).

Implement this with the following STRICT RULES:

# 1. ADVANCED PROJECT DETECTION LOGIC
Refactor the detection script to check for multiple indicators:
- Kotlin/Compose Desktop: Check for `build.gradle.kts` OR `build.gradle` AND `settings.gradle.kts`.
- Electron/Node: Check for `package.json` (and look for "electron-builder" or "make" in scripts).
- Flutter: Check for `pubspec.yaml`.

# 2. CROSS-PLATFORM OS AWARENESS
Use Node's `process.platform` to determine the current host OS and set the target output:
- `darwin` (macOS) -> Target: `.app` or `.dmg`
- `win32` (Windows) -> Target: `.exe` or `.msi`
- `linux` (Linux) -> Target: `.deb` or `.AppImage`

# 3. EXECUTING THE CORRECT BUILD COMMANDS
Based on the detected framework and OS, the agent should formulate the correct command:
- For Compose Multiplatform (Kotlin): 
  Run `./gradlew packageDistributionForCurrentOS` or `./gradlew :desktop:packageReleaseDistributionForCurrentOS` (detect if there is a specific `desktop` module). Adjust for Windows (`gradlew.bat`).
- For Flutter: 
  Run `flutter build macos` / `flutter build windows` / `flutter build linux` based on the host OS.
- For Electron: 
  Run `npm run make` or `npm run build` depending on package.json scripts.

# 4. AGENT EVENT STREAM INTEGRATION
The build process takes time. The agent MUST NOT block the UI. 
Integrate the build process with our cognitive tags:
1. `[exploring]` Scanning directory for framework files...
2. `[thinking]` Detected Kotlin Multiplatform project. Host OS is macOS.
3. `[terminal]` Running Gradle build command to generate .app...
4. Wait for the process to finish and handle errors using the Debug Agent if the build fails.
5. `[done]` Build successful! Executable located at <path>.

Please provide the updated Node.js logic/class for the `ProjectBuilder` or update the relevant agent file handling this. Ensure it works flawlessly across Mac, Windows, and Linux.
The Hoosh AI Build Manager successfully detected the Gradle project, but the build failed for two reasons:
1. Java Version Mismatch: "Gradle requires JVM 17 or later to run. Your build is currently configured to use JVM 8."
2. Incorrect Build Command: The agent ran `gradlew build`, which only compiles code. It doesn't generate a `.app` / `.exe` file for Compose Desktop.

We are building a FULLY AUTONOMOUS OS. The Agent already has access to:
- A Built-in Browser & Downloader
- A Tool/Language Installer module
- Open VSX extension registry
- TWO Terminals: Local Project Terminal & Global System Terminal

If Cursor hasn't wired these capabilities to the Agent's action space yet, DO IT NOW. The Agent must know it has the power to install missing dependencies autonomously.

Please rewrite the Build Manager / Orchestrator logic with these strict rules:

# 1. AUTONOMOUS PRE-FLIGHT CHECK & INSTALLATION (CRITICAL)
Before running Gradle, check for JVM 17+.
- On macOS: Check `/usr/libexec/java_home -v 17`.
- If JDK 17+ is MISSING, DO NOT ask the user. The Agent must autonomously install it using the Global System Terminal or the internal tool installer.
  - Mac example: `brew install openjdk@17`
  - Windows example: `winget install Microsoft.OpenJDK.17` or `choco install openjdk17`
- After installation, dynamically set the `JAVA_HOME` environment variable for the local terminal process so the build succeeds without requiring a system restart.

# 2. CORRECT COMPOSE DESKTOP PACKAGING COMMAND
The agent must check the directory structure. If a `desktop` module exists:
- Command for macOS/Linux: `./gradlew :desktop:packageDistributionForCurrentOS`
- Command for Windows: `gradlew.bat :desktop:packageDistributionForCurrentOS`
Do NOT use `gradlew build`.

# 3. ADVANCED SELF-HEALING BUILD PROCESS
Update the `DEBUG AGENT` logic:
If any terminal command fails with a "JVM", "Java", or "Missing package" error, the agent must immediately self-heal:
[reading] Scanning terminal error...
[thinking] Build failed: System is using Java 8, but Gradle requires Java 17+. I have system terminal access.
[planning] I will install JDK 17 autonomously using Homebrew/Winget, update JAVA_HOME, and retry the build.
[executing] Running `brew install openjdk@17` in the Global System Terminal...
[rewriting] Setting internal JAVA_HOME environment variable...
[executing] Retrying `./gradlew :desktop:packageDistributionForCurrentOS`...
[done] Executable successfully built.

# 4. CAPABILITY WIRING
Ensure the System Prompt / Context given to the LLM explicitly states:
"You have root/system-level terminal access, a built-in downloader, and a tool installer. If a dependency (like Java, Python, Node, Flutter) is missing, YOU MUST autonomously download and install it using the appropriate package manager (brew, apt, winget, npm) before failing or asking the user."

Refactor the execution blocks to implement this fully autonomous self-healing pipeline.
The agent is STILL executing the exact string `gradlew --no-daemon build`. This means you failed to find and replace the hardcoded command in the backend codebase.

Please follow these EXACT steps to fix this permanently:

# STEP 1: GLOBAL SEARCH
Search the entire workspace (all .js and .ts files) for the exact string: `gradlew --no-daemon build` or `gradlew build`. 
Look specifically inside files like `composeBuildPipeline.js`, `negahRunner.js`, `buildManager.js`, or wherever the terminal commands are defined.

# STEP 2: REWRITE THE EXECUTION BLOCK
Once you find that string, completely delete it. Replace it with this robust, OS-aware, Java-17-injected execution block:

```javascript
const { exec, execSync } = require('child_process');

// 1. Determine correct executable and task
const isWin = process.platform === 'win32';
const gradleCmd = isWin ? 'gradlew.bat' : './gradlew'; // MUST use ./ on mac/linux
const buildTask = ':desktop:packageDistributionForCurrentOS'; // Correct task for generating .app/.exe
const fullCommand = `${gradleCmd} ${buildTask}`;

// 2. Inject JAVA_HOME 17 specifically for macOS
const buildEnv = Object.assign({}, process.env);
if (process.platform === 'darwin') {
    try {
        const java17Path = execSync('/usr/libexec/java_home -v 17').toString().trim();
        buildEnv.JAVA_HOME = java17Path;
    } catch (err) {
        console.warn('JDK 17 not found via java_home. Attempting to proceed or prompt user to install it.');
    }
}

// 3. Execute the command
// Make sure to replace your existing exec/spawn call with this:
exec(fullCommand, { 
    cwd: projectRoot, // Ensure this points to the user's project
    env: buildEnv,
    maxBuffer: 10 * 1024 * 1024 
}, (error, stdout, stderr) => {
    // Handle output here...
});

The user wants to add a "Web-LLM Automation Bridge" to the Hoosh AI Operating System. 
Instead of relying solely on paid APIs or local Ollama models, the app must allow the user to log in to the official web interfaces of ChatGPT (chatgpt.com), Claude (claude.ai), DeepSeek (chat.deepseek.com), Gemini (gemini.google.com), etc., via an internal browser window. The system will save the session (cookies/localStorage) and use Playwright (or Electron's BrowserView/session) to automate sending prompts and scraping responses in the background.

Please implement this massive feature by following these STRICT ARCHITECTURAL STEPS:

# 1. SESSION MANAGER & UI LOGIN (The Auth Gateway)
Create a `WebLLMAuthManager`.
- It should expose a method to open a visible browser window (using Playwright or Electron BrowserWindow) pointing to the requested AI service (e.g., https://chatgpt.com).
- Instruct the user: "Please log in manually. Close this window when you see the chat interface."
- Crucially, configure the browser context to persistently save the session (Cookies, LocalStorage, IndexedDB) to a specific directory (e.g., `~/.aivon-os/web-sessions/<service-name>`).

# 2. THE HEADLESS SCRAPING ENGINE (The Web Agents)
Create a `WebLLMBridge` class. When a prompt is routed to a web model:
- Launch a Headless browser (or hidden window) using the saved persistent session.
- Inject the prompt into the specific textarea of the service.
  *Note: Use robust, modern selectors or XPath. For example, ChatGPT usually uses `#prompt-textarea`, Claude uses `[contenteditable="true"]`.*
- Simulate human typing or paste the text, then trigger the "Send" button.
- Implement a DOM MutationObserver or polling mechanism to wait for the AI's response to finish streaming (e.g., wait for the stop-generating button to disappear, or wait for the network to idle).
- Extract the final text from the latest response bubble.

# 3. ROUTER INTEGRATION (Adding to the Hoosh Arsenal)
Integrate these new "Web Models" into the `AUTO AGENT` router logic.
- Register new model IDs: `web:chatgpt`, `web:claude`, `web:deepseek`, `web:gemini`, `web:grok`, `web:perplexity`.
- If the Auto Agent decides to use `web:claude`, it calls the `WebLLMBridge`.
- If the bridge detects that the session is expired (e.g., it is redirected to the login page), it must gracefully pause the execution and emit an `[ask]` event to the UI: "Session expired for Claude. Please open the internal browser to log in again."

# 4. ERROR HANDLING & CLOUDFLARE BYPASS
- Playwright Stealth: If using Playwright, strongly consider integrating `playwright-extra` and `puppeteer-extra-plugin-stealth` to avoid Cloudflare/Datadome blocks on these AI sites.
- Timeout Handling: Web scraping is fragile. Set a strict timeout (e.g., 60 seconds). If the DOM changes or the site blocks the request, catch the error, close the hidden browser, and fallback to an offline Ollama model seamlessly.

Please generate the foundational Node.js code for `WebLLMAuthManager` and `WebLLMBridge` and integrate it into the main Orchestrator.

جمع‌بندی رفتار فعلی
چند مدل «فعال» در تنظیمات = یک لیست مجاز، نه اجرای هم‌زمان چند مدل

allowed_models (همان چند تیک‌خورده) فقط می‌گوید کدام مدل‌ها اصلاً مجازند؛ مثل فیلتر امنیتی برای مسیریاب و برای حالت دستی.
در هر درخواست چت، عملاً یک مدل اجرا می‌شود — همان چیزی که در انتخاب مدل (dropdown) برای آن پیام استفاده می‌شود، مگر اینکه حالت خودکار / هیبرید / آنلاین باشد و Router یک مدل را از بین همان مجازها انتخاب کند.
حالت‌ها به‌طور خلاصه
حالت انتخاب کاربر (User / manual)

مدل اصلی = user_selected_model (همان انتخاب‌شده در پنل).
اگر چند مدل تیک خورده باشند، همه در allowed_models هستند؛ ولی فقط همان یکی که در dropdown انتخاب کرده‌ای برای آن پیام به Ollama / وب فرستاده می‌شود.
اگر مدل انتخابی خارج از لیست مجاز باشد، خطای «مجاز نیست» می‌گیری.
حالت خودکار (Hybrid / Online / … و manual: false)

decideRouting از بین مدل‌های مجاز (و محلی/ابری/وب طبق تنظیمات) یک مدل اصلی را با heuristics (نوع کار، سخت‌افزار، …) برمی‌گزیند.
در تصمیم مسیریاب ممکن است مدل پشتیبان (fallback) هم تعریف شود برای وقتی اولی خطا بخورد؛ باز هم همزمان چند مدل جواب یک پیام را تولید نمی‌کنند.
چند مدل فعال ≠ ترکیب جواب‌ها

الان آنسامبل یا «چند LLM با هم یک پاسخ ترکیبی» برای یک پیام طراحی نشده؛ فقط محدودهٔ انتخاب و گاهی fallback است.
اگر بخواهی رفتار بعدی (مثلاً رأی‌گیری بین چند مدل یا pipeline) مشخص شود، باید به‌صورت feature جدا طراحی شود؛ در کد فعلی این‌طور نیست.

ای کاش فقط سخت افزار نکشید اون مدل در نظر گرفته نشه و درغیر این صورت حالت داوری بینشون برگذار بشه تا بهترین پیام و یا ترکیب و جمع بندی پیام خوب رو نمایش بده و یا طبق اون برنامه نویسی انجام بشه! اینجوری بهتر نیست؟

بله، از نظر کیفیت پاسخ و انعطاف، ایده‌ات منطقی است؛ فقط باید بدانیم هر کدام هزینه و پیچیدگی متفاوتی دارند.

الان در کد چه اتفاقی می‌افتد
سخت‌افزار در llmRouter بیشتر برای مدل‌های محلی و سنگینی تقریبی مدل استفاده می‌شود تا مثلاً روی ماشین ضعیف مدل ۱۲۰B پیشنهاد نشود.
چند مدل فعال = فقط مجوز؛ در نهایت معمولاً یک مدل برای هر پیام انتخاب می‌شود، نه داوری بین چند خروجی.
«داوری بین مدل‌ها» یعنی چه (و چرا سخت‌تر است)
برای اینکه واقعاً بهترین متن یا ترکیب/جمع‌بندی دیده شود، معمولاً یکی از این‌ها لازم است:

رأی‌گیری / امتیازدهی
همان پرسش را به چند مدل بدهی، بعد یا یک مدل داور (meta) یا قوانین ثابت انتخاب کند کدام پاسخ بهتر است (یا چند پاراگراف از هر کدام را بچسباند).

ترکیب (merge)
دو تا سه پاسخ را به یک مدل بدهی بگوید «یک پاسخ واحد و منسجم» بسازد؛ این هم یک فراخوانی اضافه است و باید مراقب طول و هزینه بود.

برنامه‌نویسی / agent
برای کد، «بهترین» اغلب با اجرای تست/لینتر یا نمونه‌ی اجرا سنجیده می‌شود، نه فقط با مقایسه‌ی متن؛ آن هم لایه‌ی جداست.

همه‌ی این‌ها چند برابر زمان، توکن و گاهی هزینه ابری می‌خورند، پس باید اختیاری و با حد بالا (مثلاً حداکثر ۲ مدل + ۱ داور) طراحی شود.

آیا «بهتر» است؟
برای کیفیت و اعتماد در سناریوهای سخت: بله، می‌تواند بهتر باشد.
برای سرعت، سادگی و هزینه: نه همیشه؛ باید حالت سبک (همان تک‌مدل امروز) کنار حالت «داوری» بماند.
اگر بخواهی در همین پروژه قدم بعدی برداشته شود، منطقی‌ترین مسیر این است: یک حالت اختیاری مثل «مقایسه / داوری» که فقط وقتی روشن است، همان جریان چند فراخوانی + یک جمع‌بندی را انجام دهد؛ نه اینکه همیشه برای همه فعال شود.

اگر تأیید کنی که می‌خواهی پیاده‌سازی شود، بگو ترجیحت با کدام است: فقط داور متنی، یا دو پاسخ + یک جمع‌بند، و آیا محدود به چت است یا حالت agent/کد هم مدنظر است تا همان را در معماری AIPanel + companion/llmRouter جا بدهیم.

const axios = require('axios');

// شبیه‌سازی اجرای یک مدل (مهم نیست آفلاین، آنلاین یا وب باشه)
async function runModelUnsafe(modelName, prompt) {
    // اینجا لاجیک ارتباط با Ollama یا Web Bridge خودت رو میذاری
    // من به عنوان نمونه کد فرضی گذاشتم
    const res = await axios.post('http://127.0.0.1:11434/api/generate', {
        model: modelName,
        prompt: prompt,
        stream: false
    }, { timeout: 30000 }); // تایم‌اوت ۳۰ ثانیه برای جلوگیری از گیر کردن سیستم
    return res.data.response;
}

// تابع اصلی اجرای ضدگلوله
async function runGodModeEnsemble(userPrompt, activeModels, streamState) {
    streamState('routing', 'در حال انتخاب بهترین تیم از بین مدل‌های در دسترس...');

    // 1. Router Logic (میتونی اینو بدی به یک LLM سریع که خودش JSON بده)
    // فرض می‌کنیم هوش مصنوعی تصمیم گرفته این ۳ مدل رو انتخاب کنه:
    const workers = [activeModels[0], activeModels[1]]; // مثلا: ['deepseek-coder', 'web:chatgpt']
    const judgeModel = activeModels[2] || activeModels[0]; // مثلا: ['gpt-oss:120b-cloud']

    streamState('executing', `ارسال موازی درخواست به ${workers.join(' و ')}...`);

    // 2. اجرای موازی با Promise.allSettled (بخش جادویی و ضدگلوله)
    const promises = workers.map(model => 
        runModelUnsafe(model, userPrompt)
            .then(result => ({ status: 'fulfilled', model, result }))
            .catch(error => ({ status: 'rejected', model, error: error.message }))
    );

    const results = await Promise.allSettled(promises);

    // 3. فیلتر کردن مدل‌هایی که کرش کردن، لاگین نبودن یا نصب نبودن
    const successfulWorkers = results
        .filter(r => r.value.status === 'fulfilled')
        .map(r => r.value);

    const failedWorkers = results
        .filter(r => r.value.status === 'rejected')
        .map(r => r.value);

    // گزارش خطاهای سایلنت به کاربر (بدون توقف برنامه)
    if (failedWorkers.length > 0) {
        const failedNames = failedWorkers.map(f => f.model).join(', ');
        streamState('thinking', `مدل‌های [${failedNames}] در دسترس نبودند (رد شدن). ادامه با مدل‌های سالم...`);
    }

    // 4. Fallback نهایی در بدترین حالت (همه مدل‌ها کرش کردن)
    if (successfulWorkers.length === 0) {
        streamState('thinking', 'تمام مدل‌های کارگر با خطا مواجه شدند! داور خودش دست به کار می‌شود...');
        const directAnswer = await runModelUnsafe(judgeModel, userPrompt);
        return directAnswer;
    }

    // 5. مرحله داوری (The Judge)
    streamState('thinking', `دریافت ${successfulWorkers.length} پاسخ. ارجاع به داور (${judgeModel}) برای جمع‌بندی...`);
    
    // ساخت پرامپت داوری
    let judgePrompt = `You are the Supreme Judge of Hoosh AI.
The user asked: "${userPrompt}"

Here are the solutions provided by your worker AI models:\n\n`;

    successfulWorkers.forEach((worker, index) => {
        judgePrompt += `--- SOLUTION ${index + 1} (From ${worker.model}) ---\n`;
        judgePrompt += `${worker.result}\n\n`;
    });

    judgePrompt += `Your task:
1. Analyze the solutions. Are they correct? Do they miss anything?
2. If one is perfect, enhance it slightly and return it.
3. If both have good parts, merge them into the ultimate perfect solution.
4. If BOTH are terrible, ignore them and write your own flawless answer.
Provide ONLY the final best answer.`;

    streamState('writing', 'در حال تولید پاسخ نهایی ترکیبی...');
    const finalAnswer = await runModelUnsafe(judgeModel, judgePrompt);

    return finalAnswer;
}

module.exports = { runGodModeEnsemble };


You are the Resource Manager for Hoosh AI. 
The user has asked: "[USER_PROMPT]"

Available models currently enabled by the user (Some might be offline, some online, some web logins):
[LIST_OF_ENABLED_MODELS]

Your job is to select exactly 2 Worker models and 1 Judge model from the list.
- Workers should be highly specialized (e.g., coders for code, vision for images).
- The Judge MUST be the smartest, most reasoning-capable model available in the list to evaluate the workers.
- If the user only enabled 1 or 2 models in total, just output them.

Output strictly as JSON:
{
  "workers": ["model_name_1", "model_name_2"],
  "judge": "model_name_3"
}
