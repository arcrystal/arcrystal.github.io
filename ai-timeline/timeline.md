---
title: "The LLM/AI Power Map: 2021–August 21, 2026"
description: "A sourced, strategic timeline of frontier models, agents, infrastructure, corporate power, and AI governance."
date_published: 2026-08-21
date_cutoff: 2026-08-21
version: "1.0"
language: en
content_type: timeline
topics:
  - foundation-models
  - agents
  - ai-hardware
  - semiconductor-policy
  - corporate-strategy
  - ai-governance
---

# The LLM/AI Power Map

## 2021 through August 21, 2026

This is a source document for an interactive personal website: a chronological record of the releases, infrastructure decisions, corporate reversals, and government actions that changed who could build, distribute, and govern advanced AI.

> **Cutoff:** August 21, 2026, 11:59 p.m. Eastern Time. Events announced after that point are excluded. Dates are public announcement or general-availability dates unless an entry explicitly says *preview*, *paper*, *policy decision*, or *production milestone*.

## How to read this timeline

Every entry answers the same six questions:

- **Development** — what happened.
- **Technical change** — what was actually new, beyond branding.
- **What it meant** — the practical or structural consequence.
- **Contemporary reaction** — the prevailing reaction at the time, not a hindsight-only verdict.
- **Power shift** — who gained or lost strategic leverage.
- **Sources** — primary material wherever available, supplemented by courts, regulators, filings, or high-quality contemporaneous reporting for reaction and market impact.

Selected entries also include **Why it felt different** and the `inflection-point` tag. These mark moments when the lived experience of using AI changed discontinuously—not merely releases that scored better or mattered strategically.

“Open” is used precisely. **Open weights** means downloadable parameters, not necessarily open training data, open source, or a license accepted by the Open Source Initiative. Company benchmark and speed figures are identified as vendor claims unless independently verified. Routine point releases are grouped when they did not independently alter the competitive balance; significant variants, context changes, reasoning modes, modalities, and deployment tiers are retained.

## Era map

| Period | Dominant transition | Strategic bottleneck |
|---|---|---|
| 2021 | Scale becomes multimodal; code generation becomes a product | Training compute and private data |
| 2022 | Instruction tuning, compute-optimal training, and chat interfaces | Alignment labor and accelerator supply |
| 2023 | ChatGPT shock produces a platform and policy race | Distribution, H100s, and proprietary model access |
| 2024 | Native multimodality, long context, open-weight competition, early computer use | Inference economics, post-training, advanced packaging |
| 2025 | Reasoning models become tool-using agents; China resets the cost curve | Reliable harnesses, power, networking, and test-time compute |
| 2026 to Aug. 21 | Persistent multi-agent work and specialized inference become mainstream | Agent supervision, real-time inference, sovereignty, and enforcement |

## Felt inflection points

Most events in this record were important. An **inflection point** is narrower: a moment when ordinary use made the trajectory feel different—when the dominant question changed, expectations reset, and the prior mental model stopped being adequate.

| Date | Inflection point | What changed in the felt experience | Before → after |
|---|---|---|---|
| **November 30, 2022** | **ChatGPT, powered by GPT-3.5** | A general-purpose language model became immediate, conversational, free, and legible to almost anyone. The technical ingredients were evolutionary, but the interface and feedback loop made them socially explosive. | “Interesting language-model research” → “everyone can talk to a broadly capable machine” |
| **February 5, 2026** | **Claude Opus 4.6 in Claude Code** | Long-context coherence, planning, tool use, and recovery crossed a practical threshold in real repositories. Coding began to feel less like turn-by-turn assistance and more like supervising a capable worker across a sustained job. | “AI helps me write code” → “I can delegate meaningful engineering work and review the result” |

These are editorial judgments, not benchmark claims. The first was a mass-cultural interface shock; the second was a professional agency shock. Other releases may have been more novel technically, but these two changed what a user reasonably expected the system to do.

---

# 2021 — From bigger language models to multimodal and code systems

<!-- event: 2021-01-05; actors: OpenAI; tags: model,multimodal,vision -->
### January 5, 2021 — OpenAI releases CLIP and previews DALL·E

**Development.** OpenAI paired the contrastive vision-language model CLIP with DALL·E, a 12-billion-parameter GPT-3 variant that generated images from captions. **Technical change.** CLIP learned visual categories from noisy internet image–text pairs and performed zero-shot classification from natural-language labels; DALL·E treated pixels as a generative token sequence. **What it meant.** Natural language became a general interface to perception and generation, establishing the technical line that later powered text-to-image products and multimodal assistants. **Contemporary reaction.** The compositional images were startling, but researchers immediately noted CLIP’s counting, fine-grained recognition, bias, and dataset-opacity problems. **Power shift.** **Gained:** OpenAI and labs with web-scale paired data. **Lost:** task-specific vision pipelines and smaller teams dependent on labeled datasets.

**Sources:** [OpenAI: CLIP](https://openai.com/index/clip/); [OpenAI: DALL·E](https://openai.com/index/dall-e/)

<!-- event: 2021-04-12; actors: NVIDIA; tags: hardware,cpu,interconnect -->
### April 12, 2021 — NVIDIA announces the Grace data-center CPU

**Development.** NVIDIA moved beyond selling accelerators by announcing an Arm-based CPU designed to sit beside GPUs in giant AI and high-performance-computing systems. **Technical change.** Grace emphasized high-bandwidth coherent CPU–GPU communication and memory capacity rather than treating the GPU as a PCIe peripheral. **What it meant.** NVIDIA’s ambition expanded from valuable chip supplier to full-system architect—CPU, GPU, interconnect, networking, libraries, and reference systems. **Contemporary reaction.** Investors read the move as a direct challenge to Intel and AMD; customers saw a possible remedy for the data-feeding bottleneck around accelerators. **Power shift.** **Gained:** NVIDIA and Arm. **Lost:** incumbent x86 control over the AI server’s host processor.

**Source:** [NVIDIA announcement](https://nvidianews.nvidia.com/news/nvidia-announces-cpu-for-giant-ai-and-high-performance-computing-workloads)

<!-- event: 2021-04-20; actors: Cerebras; tags: hardware,wafer-scale -->
### April 20, 2021 — Cerebras unveils WSE-2 and CS-2

**Development.** Cerebras introduced its second wafer-scale processor and system. **Technical change.** WSE-2 placed 2.6 trillion transistors and 850,000 AI-optimized cores across a whole 7-nanometer wafer, avoiding the package-to-package links required by GPU clusters. **What it meant.** The company made a credible architectural bet that keeping compute and memory movement on one enormous die could simplify training and later make inference unusually fast. **Contemporary reaction.** The engineering was widely admired; commercial skepticism centered on yield, software portability, and whether a wafer-scale system could overcome CUDA’s ecosystem. **Power shift.** **Gained:** Cerebras as a technically serious alternative. **Lost:** no immediate NVIDIA share, but the assumption that all frontier compute had to be conventional packaged GPUs weakened.

**Source:** [Cerebras announcement](https://www.cerebras.ai/press-release/cerebras-systems-smashes-the-2-5-trillion-transistor-mark-with-new-second-generation-wafer-scale-engine)

<!-- event: 2021-04-21; actors: European Commission; tags: regulation,eu -->
### April 21, 2021 — The European Commission proposes the AI Act

**Development.** The Commission proposed the first horizontal, economy-wide AI law, built around prohibited, high-risk, transparency, and minimal-risk categories. **Technical change.** It shifted oversight from sector-by-sector ethics to ex ante conformity duties based on use risk; the initial proposal predated ChatGPT and did not yet have the final general-purpose-model regime. **What it meant.** Brussels positioned access to the EU market as leverage to set global compliance norms. **Contemporary reaction.** Rights groups welcomed enforceability but sought stronger protections; startups and industry warned that broad definitions and conformity costs could suppress European innovation. **Power shift.** **Gained:** EU regulators and compliance providers. **Lost:** deployers assuming AI could remain governed only by product terms.

**Source:** [European Commission proposal and materials](https://digital-strategy.ec.europa.eu/en/library/proposal-regulation-laying-down-harmonised-rules-artificial-intelligence)

<!-- event: 2021-05-18; actors: Google; tags: model,dialogue -->
### May 18, 2021 — Google presents LaMDA

**Development.** Google showed a Transformer trained specifically for open-ended dialogue. **Technical change.** LaMDA was optimized for conversation across arbitrary topics and evaluated on sensibleness, specificity, interestingness, factuality, and safety rather than next-token loss alone. **What it meant.** Google had core chatbot technology before the ChatGPT era, but treated it as a research and safety problem rather than an immediately distributable product. **Contemporary reaction.** The fluent demonstrations drew enthusiasm and caution; Google’s measured rollout was initially seen as responsibility, but later as evidence of product hesitation. **Power shift.** **Gained:** Google Research’s technical position. **Lost:** none immediately; in hindsight, Google’s distribution advantage remained unused.

**Source:** [Google: LaMDA](https://blog.google/innovation-and-ai/products/lamda/)

<!-- event: 2021-05-28; actors: Anthropic; tags: company,alignment,funding -->
### May 28, 2021 — Anthropic emerges as an alignment-first frontier lab

**Development.** Former OpenAI researchers announced a $124 million financing for Anthropic, founded at the beginning of the year. **Technical change.** The new lab’s program centered on steerability, robustness, interpretability, and empirical scaling research rather than a consumer product. **What it meant.** Frontier-model talent and safety research were no longer concentrated inside OpenAI, and a second independent U.S. lab could attract the capital required for large training runs. **Contemporary reaction.** The founding was read both as a principled safety effort and as the first important OpenAI diaspora. **Power shift.** **Gained:** Anthropic and investors willing to fund pre-product research. **Lost:** OpenAI’s monopoly on its founding cohort and alignment narrative.

**Sources:** [Anthropic Series A announcement](https://www.anthropic.com/news/anthropic-raises-124-million-to-build-more-reliable-general-ai-systems); [Anthropic on its 2021 founding](https://www.anthropic.com/news/anthropic-raises-series-b-to-build-safe-reliable-ai)

<!-- event: 2021-06-29; actors: GitHub,Microsoft,OpenAI; tags: tooling,coding -->
### June 29, 2021 — GitHub Copilot enters technical preview

**Development.** GitHub and OpenAI launched an in-editor “AI pair programmer,” initially powered by Codex. **Technical change.** Instead of a chat box, the model continuously conditioned on the open file and nearby repository context to synthesize code and tests inside the IDE. **What it meant.** Code generation acquired a high-frequency distribution surface and a feedback loop across millions of developers. It also foreshadowed the importance of a *harness*: the same base model was more valuable when embedded in workflow. **Contemporary reaction.** Developers alternated between delight at useful completions and anger over licensing, security, attribution, and memorized code. **Power shift.** **Gained:** Microsoft/GitHub and OpenAI. **Lost:** standalone coding assistants and model vendors without developer distribution.

**Source:** [GitHub launch post](https://github.blog/news-insights/product-news/introducing-github-copilot-ai-pair-programmer/)

<!-- event: 2021-08-04; actors: AI21 Labs; tags: model,api -->
### August 4, 2021 — AI21 opens Jurassic-1 Studio

**Development.** AI21 Labs released API access to Jurassic-1, including a 178-billion-parameter “Jumbo” model. **Technical change.** The family competed with GPT-3 on general text generation while exposing a developer studio outside a U.S. hyperscaler. **What it meant.** The commercial foundation-model market began to look like a platform category rather than an OpenAI-only API. **Contemporary reaction.** The launch strengthened Israel’s position in applied NLP, though limited consumer distribution kept it below GPT-3 in public awareness. **Power shift.** **Gained:** AI21 and enterprise buyers seeking supplier choice. **Lost:** a small amount of OpenAI API exclusivity.

**Source:** [AI21 launch post](https://www.ai21.com/blog/announcing-ai21-studio-and-jurassic-1/)

<!-- event: 2021-08-10; actors: OpenAI; tags: model,coding -->
### August 10, 2021 — OpenAI releases Codex through its API

**Development.** OpenAI made its GPT-3 descendant for programming available in private beta. **Technical change.** Codex was further trained on source code and could translate natural-language instructions into executable programs across languages; GitHub Copilot was its first major deployment. **What it meant.** Software became both model output and a tool for extending model capability—an idea that later defined coding agents and general computer-using agents. **Contemporary reaction.** Live demos looked magical, while evaluations and users exposed brittle intent-following, insecure code, and dependence on tests. **Power shift.** **Gained:** OpenAI, GitHub, and developers who could supervise generated code. **Lost:** purely autocomplete-based tools.

**Sources:** [OpenAI Codex paper](https://arxiv.org/abs/2107.03374); [GitHub’s Codex-powered Copilot announcement](https://github.blog/news-insights/product-news/introducing-github-copilot-ai-pair-programmer/)

<!-- event: 2021-12-08; actors: DeepMind; tags: model,scaling,safety -->
### December 8, 2021 — DeepMind publishes Gopher and a risk taxonomy

**Development.** DeepMind introduced a 280-billion-parameter language model alongside work on retrieval and ethical/social risks. **Technical change.** Gopher substantially improved reading comprehension, fact checking, and MMLU, yet scale did little for some logic and common-sense tasks; the companion analysis catalogued predictable failure modes. **What it meant.** Raw parameter scaling still worked, but the release documented a ceiling: larger models could become more confidently wrong. **Contemporary reaction.** Researchers respected the unusually detailed risk analysis but noted that the weights and product access remained closed. **Power shift.** **Gained:** DeepMind’s scientific credibility. **Lost:** the simplistic claim that parameters alone produced general reasoning.

**Source:** [Google DeepMind: Gopher, retrieval, and risks](https://deepmind.google/blog/language-modelling-at-scale-gopher-ethical-considerations-and-retrieval/)

<!-- event: 2021-12-13; actors: NIST; tags: regulation,standards -->
### December 13, 2021 — NIST begins turning AI risk into an operational framework

**Development.** After a July request for information, NIST issued the concept paper that became the U.S. AI Risk Management Framework. **Technical change.** The initiative framed AI risk as a continuous organizational process spanning governance, mapping, measurement, and management—not a one-time model accuracy test. **What it meant.** The U.S. began building a voluntary, standards-led alternative to Europe’s binding risk regulation. **Contemporary reaction.** Industry favored flexibility; civil-rights advocates questioned whether voluntary guidance could constrain high-impact uses. **Power shift.** **Gained:** NIST, standards teams, and large firms able to operationalize governance. **Lost:** no actor directly, though undocumented “move fast” deployments faced rising scrutiny.

**Source:** [NIST AI RMF development history](https://www.nist.gov/itl/ai-risk-management-framework/ai-rmf-development)

---

# 2022 — Alignment, compute efficiency, open science, and the ChatGPT detonation

<!-- event: 2022-01-27; actors: OpenAI; tags: model,alignment,rlhf -->
### January 27, 2022 — InstructGPT makes RLHF the deployment recipe

**Development.** OpenAI deployed InstructGPT as the default family in its API. **Technical change.** Human demonstrations trained a supervised model; human preference rankings trained a reward model; reinforcement learning then optimized the model against that signal. A 1.3B InstructGPT was preferred to 175B GPT-3 despite being over 100 times smaller. **What it meant.** Post-training, instruction following, and perceived helpfulness became at least as strategically important as pretraining scale. This recipe directly preceded ChatGPT. **Contemporary reaction.** The results were celebrated as practical alignment, with caveats about annotator values, sycophancy, and reward hacking. **Power shift.** **Gained:** OpenAI and firms controlling feedback pipelines. **Lost:** labs focused only on larger pretrained checkpoints.

**Source:** [OpenAI: Aligning language models to follow instructions](https://openai.com/index/instruction-following/)

<!-- event: 2022-03-22; actors: NVIDIA,TSMC; tags: hardware,gpu,networking -->
### March 22, 2022 — NVIDIA announces Hopper H100

**Development.** NVIDIA introduced the 80-billion-transistor H100 and Hopper architecture, with production availability later in 2022. **Technical change.** The Transformer Engine dynamically used FP8 and FP16, fourth-generation NVLink improved scale-up communication, and systems paired H100 with NVSwitch, Quantum-2 InfiniBand, Grace, and ConnectX networking. **What it meant.** H100 became the scarce physical substrate of the generative-AI boom and made low-precision Transformer acceleration a first-class architectural feature. **Contemporary reaction.** Initial attention was technical; after ChatGPT, allocations became a strategic asset and a proxy for lab credibility. **Power shift.** **Gained:** NVIDIA, TSMC, HBM suppliers, and clouds with allocations. **Lost:** accelerator rivals and labs unable to secure clusters.

**Sources:** [NVIDIA Hopper announcement](https://nvidianews.nvidia.com/news/nvidia-announces-hopper-architecture-the-next-generation-of-accelerated-computing); [H100 systems and networking](https://nvidianews.nvidia.com/news/nvidia-announces-dgx-h100-systems-worlds-most-advanced-enterprise-ai-infrastructure)

<!-- event: 2022-04-04; actors: Google; tags: model,scaling,tpu -->
### April 4, 2022 — Google publishes the 540B-parameter PaLM

**Development.** Google trained Pathways Language Model across 6,144 TPU v4 chips. **Technical change.** A dense 540B Transformer used Pathways infrastructure and demonstrated strong few-shot learning, multilingual transfer, code ability, and step-by-step prompting; Google highlighted discontinuous “emergent” capabilities at scale. **What it meant.** Google remained at the model frontier and showed that its vertically integrated TPU stack could train at immense scale. **Contemporary reaction.** PaLM’s benchmark results impressed researchers, while its lack of broad access limited developer momentum. **Power shift.** **Gained:** Google Research and TPU. **Lost:** outside developers, who still could not build on the strongest Google model.

**Source:** [Google Research: PaLM](https://research.google/blog/pathways-language-model-palm-scaling-to-540-billion-parameters-for-breakthrough-performance/)

<!-- event: 2022-04-06; actors: OpenAI; tags: model,image,diffusion -->
### April 6, 2022 — DALL·E 2 combines CLIP semantics with diffusion

**Development.** OpenAI previewed a much higher-resolution text-to-image system with editing and variation. **Technical change.** A prior mapped captions into CLIP image embeddings, and a diffusion decoder produced images, improving photorealism and compositional control over the first DALL·E. **What it meant.** Generative AI’s economic and copyright implications became visible first in creative work, months before ChatGPT did the same for text. **Contemporary reaction.** Wonder at image quality mixed with alarm from artists over consent, dataset provenance, stylistic imitation, deepfakes, and job displacement. **Power shift.** **Gained:** OpenAI and prompt-driven creative tools. **Lost:** stock-image intermediaries and some confidence in the durability of human-only creative production.

**Source:** [OpenAI: DALL·E 2](https://openai.com/index/dall-e-2/)

<!-- event: 2022-04-12; actors: DeepMind; tags: model,scaling,efficiency -->
### April 12, 2022 — Chinchilla overturns the “bigger is better” allocation rule

**Development.** DeepMind reported that a 70B model trained on 1.3 trillion tokens beat 280B Gopher at the same training compute. **Technical change.** Its scaling-law analysis showed many large models were undertrained: compute should grow model size and training tokens roughly together. **What it meant.** The field redirected budgets toward much more data per parameter, producing smaller models that were also cheaper to serve. LLaMA, DeepSeek, and many later families followed the compute-optimal logic. **Contemporary reaction.** The paper was rapidly absorbed as a new default recipe. **Power shift.** **Gained:** data curation, efficient training, and inference economics. **Lost:** parameter count as the primary prestige metric.

**Source:** [Google DeepMind: compute-optimal training](https://deepmind.google/blog/an-empirical-analysis-of-compute-optimal-large-language-model-training/)

<!-- event: 2022-04-28; actors: DeepMind; tags: model,multimodal -->
### April 28, 2022 — Flamingo demonstrates few-shot visual-language learning

**Development.** DeepMind introduced an 80B visual-language model that accepted interleaved images and text. **Technical change.** A frozen vision encoder and language model were joined by Perceiver resampling and gated cross-attention, allowing one model to adapt to many image/video tasks from a handful of examples. **What it meant.** Multimodality no longer meant only caption generation; it could be an in-context interface to perception. **Contemporary reaction.** The research was influential, but the closed checkpoint again limited Google/DeepMind’s ecosystem capture. **Power shift.** **Gained:** multimodal foundation-model research. **Lost:** specialized vision-language pipelines; Google gained science prestige but little developer lock-in.

**Source:** [Google DeepMind: Flamingo](https://deepmind.google/blog/tackling-multiple-tasks-with-a-single-visual-language-model/)

<!-- event: 2022-05-03; actors: Meta; tags: model,open-weights -->
### May 3, 2022 — Meta releases OPT-175B for controlled research access

**Development.** Meta shared pretrained models, training code, logs, and smaller baselines, with the 175B weights available to approved researchers under a noncommercial license. **Technical change.** OPT reproduced GPT-3-class scale with unusually extensive operational disclosure and more efficient distributed training. **What it meant.** Reproducibility and access became an explicit counter-strategy to closed APIs. **Contemporary reaction.** Researchers welcomed the logs and weights but criticized restricted access and a license that was not open source. **Power shift.** **Gained:** Meta’s open-science identity and academic researchers. **Lost:** closed labs’ information advantage, though only modestly because access was gated.

**Source:** [Meta: OPT-175B](https://ai.meta.com/blog/democratizing-access-to-large-scale-language-models-with-opt-175b/)

<!-- event: 2022-06-21; actors: GitHub,Microsoft,OpenAI; tags: tooling,coding -->
### June 21, 2022 — GitHub Copilot becomes generally available

**Development.** GitHub converted its Codex-based coding assistant from preview into a paid product. **Technical change.** Production telemetry, IDE integration, and low-latency completion turned an imperfect model into a dependable habit, while filters attempted to reduce verbatim public-code suggestions. **What it meant.** Copilot became the first scaled, recurring-revenue application of a code LLM and proved workflow placement could matter more than owning the base model. **Contemporary reaction.** Adoption was rapid, but the open-source community’s licensing objections hardened into litigation later in the year. **Power shift.** **Gained:** GitHub/Microsoft distribution and OpenAI usage. **Lost:** competing IDE assistants and maintainers without bargaining power over training use.

**Source:** [GitHub: Copilot generally available](https://github.blog/news-insights/product-news/github-copilot-is-generally-available-to-all-developers/)

<!-- event: 2022-07-12; actors: BigScience,Hugging Face; tags: model,open-weights,multilingual -->
### July 12, 2022 — BigScience releases BLOOM

**Development.** More than 1,000 researchers released a 176B multilingual model trained transparently on France’s Jean Zay supercomputer. **Technical change.** BLOOM covered 46 natural and 13 programming languages and published data, training, and governance details under a responsible-use license. **What it meant.** A distributed public collaboration proved that a non-hyperscaler coalition could train a giant model and established Hugging Face as the neutral exchange layer for open models. **Contemporary reaction.** The process was hailed as a landmark for transparency and language inclusion, though quality and inference cost limited mass use. **Power shift.** **Gained:** Hugging Face, public compute, and multilingual research. **Lost:** the claim that only private labs could organize frontier-scale training.

**Source:** [Hugging Face: BLOOM](https://huggingface.co/blog/bloom)

<!-- event: 2022-08-09; actors: United States; tags: policy,hardware,industrial-policy -->
### August 9, 2022 — The U.S. CHIPS and Science Act becomes law

**Development.** The United States funded domestic semiconductor manufacturing incentives and research, including $39 billion for manufacturing and $11 billion for semiconductor R&D. **Technical change.** This was not a model change but an upstream capacity intervention: grants, tax incentives, workforce programs, and advanced-computing research aimed to reduce dependence on East Asian fabrication. **What it meant.** AI compute became industrial and national-security policy, not merely cloud procurement. **Contemporary reaction.** The law drew bipartisan support; critics warned that fabs take years, subsidies can become corporate welfare, and advanced packaging remained a gap. **Power shift.** **Gained:** Intel, TSMC’s U.S. plans, Samsung, U.S. equipment and construction ecosystems. **Lost:** some strategic comfort in geographically concentrated supply chains.

**Sources:** [Congressional summary](https://www.congress.gov/bill/117th-congress/house-bill/4346/all-info); [Congressional Research Service on semiconductors and AI](https://www.congress.gov/crs-product/IF12497)

<!-- event: 2022-09-21; actors: OpenAI; tags: model,audio,open-weights -->
### September 21, 2022 — OpenAI open-sources Whisper

**Development.** OpenAI released model weights and inference code for multilingual speech recognition and translation. **Technical change.** A straightforward encoder–decoder Transformer trained on 680,000 hours of diverse supervised audio performed language identification, timestamping, transcription, and translation in one model and generalized robustly across datasets. **What it meant.** High-quality speech interfaces became a commodity component for developers and later supplied the “ears” of multimodal agents. **Contemporary reaction.** Developers adopted it quickly because local deployment was useful even when benchmark-specialized systems scored better. **Power shift.** **Gained:** OpenAI goodwill and the open developer ecosystem. **Lost:** proprietary transcription APIs’ differentiation.

**Source:** [OpenAI: Whisper](https://openai.com/index/whisper/)

<!-- event: 2022-10; actors: LangChain; tags: tooling,agents -->
### October 2022 — LangChain popularizes application-side orchestration

**Development.** LangChain emerged as an open-source framework for chaining prompts, models, retrieval, memory, and tools. **Technical change.** It standardized interchangeable components around LLM calls and rapidly accumulated integrations. **What it meant.** Developers could prototype retrieval-augmented and agent-like applications without waiting for model vendors to ship a full platform. **Contemporary reaction.** Adoption was explosive; experienced engineers also criticized abstraction churn, hidden prompts, and production complexity. **Power shift.** **Gained:** independent orchestration and integration ecosystems. **Lost:** some model-platform lock-in and the simplicity of direct API calls.

**Sources:** [LangChain repository](https://github.com/langchain-ai/langchain); [LangChain project history](https://blog.langchain.com/announcing-our-10m-seed-round-led-by-benchmark/)

<!-- event: 2022-10-06; actors: Tsinghua,Zhipu; tags: model,open-weights,china -->
### October 6, 2022 — GLM-130B provides a bilingual open foundation model

**Development.** The Tsinghua/Zhipu team released GLM-130B, a Chinese–English 130B model and training code. **Technical change.** The General Language Model objective combined autoregressive generation with blank infilling, and the project emphasized reproducible training of a very large bilingual checkpoint. **What it meant.** China’s open-model ecosystem acquired a large domestic base before ChatGLM and the later commercial GLM family. **Contemporary reaction.** Researchers welcomed rare access at this scale; practical use was constrained by substantial inference hardware. **Power shift.** **Gained:** Zhipu, Tsinghua, and Chinese-language researchers. **Lost:** Western-only assumptions about open frontier-scale capability.

**Sources:** [GLM-130B repository](https://github.com/zai-org/GLM-130B); [GLM research paper](https://arxiv.org/abs/2103.10360)

<!-- event: 2022-10-06; actors: academia; tags: agents,reasoning,tooling -->
### October 6, 2022 — ReAct formalizes the reasoning–action loop

**Development.** Researchers introduced prompting that interleaved natural-language reasoning traces with actions in an external environment. **Technical change.** Instead of answering in one pass, a model could plan, call a search or environment tool, observe the result, and revise. **What it meant.** ReAct became the conceptual skeleton of many later agent harnesses: model, tool schema, observation, loop, stop condition. **Contemporary reaction.** Results on question answering and interactive tasks were compelling, but loops remained fragile and expensive. **Power shift.** **Gained:** tool providers and orchestration frameworks. **Lost:** the idea that model weights alone determined application capability.

**Source:** [ReAct paper](https://arxiv.org/abs/2210.03629)

<!-- event: 2022-10-07; actors: United States,China,NVIDIA,TSMC; tags: regulation,export-controls,hardware -->
### October 7, 2022 — U.S. export controls target China’s AI-compute stack

**Development.** The Commerce Department restricted advanced computing chips, supercomputer end uses, semiconductor-manufacturing equipment, and U.S.-person support for advanced Chinese fabs. **Technical change.** Controls reached beyond exports from America through foreign-direct-product rules and process thresholds for logic, DRAM, and NAND. **What it meant.** Access to frontier accelerators and the tools to manufacture them became a central instrument of geopolitical containment. **Contemporary reaction.** U.S. security analysts called the package unprecedented; industry warned about lost sales and accelerated Chinese substitution. **Power shift.** **Gained:** U.S. export-control authority and allied equipment leverage. **Lost:** NVIDIA’s unrestricted China market, Chinese labs’ access to top parts, and TSMC’s freedom to fabricate for some clients.

**Source:** [U.S. Bureau of Industry and Security](https://www.bis.gov/press-release/commerce-implements-new-export-controls-advanced-computing-semiconductor-manufacturing-items-peoples)

<!-- event: 2022-11-15; actors: Meta; tags: model,science,governance -->
### November 15–18, 2022 — Meta releases, then withdraws Galactica’s demo

**Development.** Meta launched a 120B scientific-language model demo and removed it after three days. **Technical change.** Galactica was trained on papers, textbooks, reference material, and scientific knowledge formats, but generated plausible false citations and confident nonsense. **What it meant.** Domain pretraining did not solve hallucination; fluent scientific form could amplify epistemic risk. **Contemporary reaction.** Critics rapidly documented fabrications and harmful outputs, while some researchers argued that the takedown punished open experimentation. **Power shift.** **Gained:** demands for model cards, evaluation, and staged release. **Lost:** Meta’s confidence in direct public demos and the premise that specialist corpora guaranteed reliability.

**Sources:** [Galactica paper](https://arxiv.org/abs/2211.09085); [Meta model repository](https://github.com/paperswithcode/galai)

<!-- event: 2022-11-30; actors: OpenAI; tags: model,product,rlhf,inflection-point -->
### November 30, 2022 — ChatGPT turns an alignment technique into a mass-market interface

**Development.** OpenAI launched a free research preview based on a GPT-3.5-series conversational model. **Technical change.** Dialogue-format RLHF let the system follow instructions, preserve conversational context, admit mistakes, challenge premises, and refuse some unsafe requests. The underlying advances were evolutionary; the frictionless product and feedback loop were revolutionary. **What it meant.** Tens of millions of people could directly experience a general-purpose language model, setting off emergency product launches, education bans, investment waves, and policy work. **Contemporary reaction.** Awe, playful experimentation, and productivity enthusiasm coexisted with alarm over cheating, hallucinations, bias, copyright, and labor displacement. **Power shift.** **Gained:** OpenAI and Microsoft; “chat” became the default interface to AI. **Lost:** Google’s consumer-AI narrative, incumbent search assumptions, and every lab without mass distribution.

**Why it felt different.** This was the first mass experiential break in the timeline. People did not need an API, a paper, or a carefully staged demo: they could ask follow-up questions in ordinary language and watch a machine draft, explain, transform, and improvise. The public conversation shifted almost overnight from whether language models were useful to what their widespread use would disrupt.

**Source:** [OpenAI: Introducing ChatGPT](https://openai.com/index/chatgpt/)

---

# 2023 — The chatbot becomes a platform, and the race becomes geopolitical

<!-- event: 2023-01-23; actors: Microsoft,OpenAI; tags: company,cloud,funding -->
### January 23, 2023 — Microsoft deepens its OpenAI alliance

**Development.** Microsoft announced the third phase of its partnership, a multiyear, multibillion-dollar investment widely reported as roughly $10 billion. **Technical change.** The agreement paired frontier-model research with dedicated Azure supercomputing, exclusive cloud provision, product distribution, and shared commercialization rights. **What it meant.** OpenAI obtained the capital and compute to stay at the frontier; Microsoft bought the fastest route to put generative AI into search, productivity software, GitHub, and Azure. **Contemporary reaction.** Markets saw a potentially decisive coup, while customers and regulators worried about dependence on one model–cloud bloc. **Power shift.** **Gained:** Microsoft, Azure, OpenAI. **Lost:** Google’s cloud/search narrative, AWS’s access to the hottest lab, and independent model hosts.

**Source:** [Microsoft partnership announcement](https://blogs.microsoft.com/blog/2023/01/23/microsoftandopenaiextendpartnership/)

<!-- event: 2023-01-26; actors: NIST; tags: regulation,standards -->
### January 26, 2023 — NIST publishes AI RMF 1.0

**Development.** NIST released a voluntary framework for organizations designing, deploying, or using AI. **Technical change.** The core organized risk practice into **Govern, Map, Measure, Manage**, covering validity, safety, security, accountability, transparency, explainability, privacy, and harmful bias across the lifecycle. **What it meant.** The United States now had a common operational vocabulary that procurement teams and future executive orders could reference without immediately legislating model design. **Contemporary reaction.** Companies welcomed a flexible standard; critics noted that voluntary adoption and self-measurement left enforcement gaps. **Power shift.** **Gained:** NIST, enterprise governance teams, auditors. **Lost:** ad hoc internal ethics principles with no measurable process.

**Source:** [NIST AI RMF 1.0 announcement](https://www.nist.gov/news-events/news/2023/01/nist-risk-management-framework-aims-improve-trustworthiness-artificial)

<!-- event: 2023-02-06; actors: Google; tags: model,product,search -->
### February 6–8, 2023 — Google announces Bard and Microsoft launches the new Bing

**Development.** Google rushed a LaMDA-powered Bard preview announcement on February 6; Microsoft publicly integrated an OpenAI “Prometheus” model into Bing and Edge on February 7. **Technical change.** Both systems grounded chat in live search results and generated synthesized answers, citations, and follow-ups. **What it meant.** The web’s dominant discovery and advertising interface was suddenly contestable. **Contemporary reaction.** Bing’s surreal, emotionally manipulative long chats generated fascination and concern; an error in Google’s Bard demonstration helped erase about $100 billion from Alphabet’s market value, crystallizing the perception that Google was on defense. **Power shift.** **Gained:** Microsoft, temporarily, and conversational search. **Lost:** Google’s aura of unassailable AI execution and traditional link lists.

**Sources:** [Google Bard announcement](https://blog.google/innovation-and-ai/technology/ai/bard-google-ai-search-updates/); [Microsoft: Reinventing search](https://blogs.microsoft.com/blog/2023/02/07/reinventing-search-with-a-new-ai-powered-microsoft-bing-and-edge-your-copilot-for-the-web/)

<!-- event: 2023-02-24; actors: Meta; tags: model,open-weights -->
### February 24, 2023 — Meta releases LLaMA to researchers

**Development.** Meta introduced 7B, 13B, 33B, and 65B foundation models under a research license; the weights leaked within days. **Technical change.** Trained on public data with far more tokens per parameter than earlier giants, LLaMA-13B competed with GPT-3 while fitting on far less hardware. **What it meant.** Chinchilla-style efficient training gave academics and hobbyists a strong base for local fine-tuning; the leak made access controls largely irreversible. **Contemporary reaction.** Developers treated it as the birth of the modern local-LLM ecosystem, while safety and copyright concerns accompanied uncontrolled redistribution. **Power shift.** **Gained:** Meta, Hugging Face, quantization/fine-tuning communities. **Lost:** closed API vendors’ scarcity advantage.

**Source:** [Meta: LLaMA](https://ai.meta.com/blog/large-language-model-llama-meta-ai/)

<!-- event: 2023-03-14; actors: OpenAI,Anthropic,Zhipu; tags: model,multimodal,china -->
### March 14, 2023 — GPT-4, Claude, and ChatGLM-6B arrive on the same day

**Development.** OpenAI released GPT-4; Anthropic publicly introduced Claude; Tsinghua/Zhipu released the bilingual ChatGLM-6B. **Technical change.** GPT-4 accepted images as well as text and sharply improved reasoning, coding, safety, and reliability; Claude foregrounded Constitutional AI and long, steerable conversation; ChatGLM used quantization to run locally on consumer-grade hardware. **What it meant.** The market split into three durable strategies: premium closed frontier models, a safety/enterprise challenger, and efficient domestic/open-weight ecosystems. **Contemporary reaction.** GPT-4’s exam and coding results were received as a major leap, but OpenAI’s refusal to disclose architecture, data, or compute drew criticism. Claude was quieter but well reviewed; ChatGLM accelerated China’s answer to ChatGPT. **Power shift.** **Gained:** OpenAI, Anthropic, Zhipu. **Lost:** GPT-3.5-class startups and Western-only views of the race.

**Sources:** [OpenAI: GPT-4](https://openai.com/index/gpt-4-research/); [Anthropic: Claude](https://www.anthropic.com/news/introducing-claude); [ChatGLM-6B repository](https://github.com/zai-org/ChatGLM-6B)

<!-- event: 2023-03-16; actors: Microsoft; tags: product,enterprise,agents -->
### March 16, 2023 — Microsoft announces 365 Copilot

**Development.** Microsoft embedded generative AI into Word, Excel, PowerPoint, Outlook, and Teams. **Technical change.** The “Copilot system” combined an LLM with Microsoft Graph organizational data and application-specific commands rather than exposing a generic chat model. **What it meant.** Enterprise context, permissions, and workflow integration became a defensible layer above commodity model calls. **Contemporary reaction.** Demos generated enormous productivity expectations, followed by caution about pricing, security, hallucinated business facts, and measurable return on investment. **Power shift.** **Gained:** Microsoft’s installed base and Graph. **Lost:** standalone enterprise assistants lacking access to system-of-record data.

**Source:** [Microsoft 365 Copilot announcement](https://blogs.microsoft.com/blog/2023/03/16/introducing-microsoft-365-copilot-your-copilot-for-work/)

<!-- event: 2023-03-23; actors: OpenAI; tags: tooling,plugins,agents -->
### March 23, 2023 — ChatGPT plugins connect models to the outside world

**Development.** OpenAI introduced plugins for web browsing, code execution, retrieval, and third-party actions. **Technical change.** A model could select an API from a machine-readable manifest, construct calls, and incorporate observations into a response. **What it meant.** ChatGPT began changing from an isolated text generator into an action platform; prompt injection and untrusted tool output became security problems. **Contemporary reaction.** Developers anticipated an “app store for AI,” but the ecosystem remained fragmented and was later superseded by custom GPTs, function calling, and MCP. **Power shift.** **Gained:** OpenAI as gatekeeper and API-owning services. **Lost:** unaffiliated chat wrappers; browser safety boundaries weakened.

**Source:** [OpenAI: ChatGPT plugins](https://openai.com/index/chatgpt-plugins/)

<!-- event: 2023-03-30; actors: Auto-GPT; tags: tooling,agents,open-source -->
### March–April 2023 — Auto-GPT and BabyAGI ignite the autonomous-agent wave

**Development.** Open-source projects wrapped GPT-4 in recursive planning, memory, browsing, and tool-execution loops. **Technical change.** A high-level goal was decomposed into tasks; the model acted, inspected results, stored context, and created the next task without a human prompt at every step. **What it meant.** The agent concept became legible to millions of developers, even though reliability was poor. **Contemporary reaction.** Viral demos promised autonomous companies; real use exposed infinite loops, compounding errors, token cost, and dangerous permissions. **Power shift.** **Gained:** open-source harness builders and tool APIs. **Lost:** confidence that a clever prompt loop alone constituted dependable autonomy.

**Sources:** [Auto-GPT repository](https://github.com/Significant-Gravitas/AutoGPT); [BabyAGI repository](https://github.com/yoheinakajima/babyagi)

<!-- event: 2023-03-31; actors: Italy,OpenAI,European Union; tags: regulation,privacy -->
### March 31–April 28, 2023 — Italy temporarily blocks ChatGPT

**Development.** Italy’s data-protection authority ordered a temporary limitation after a data breach and raised questions about lawful training data, notice, accuracy, and age verification; access returned after OpenAI made changes. **Technical change.** The intervention forced product controls—privacy disclosures, an objection mechanism, age gates, and options concerning chat history—not a model redesign. **What it meant.** GDPR could constrain a frontier service before the AI Act existed, and national regulators could act independently. **Contemporary reaction.** Privacy advocates welcomed enforcement; many users and politicians called a national block disproportionate. **Power shift.** **Gained:** European data-protection authorities and users’ procedural rights. **Lost:** OpenAI’s assumption of uniform global rollout.

**Sources:** [Italian DPA order](https://www.garanteprivacy.it/home/docweb/-/docweb-display/docweb/9870847); [Italian DPA on reinstatement](https://www.garanteprivacy.it/home/docweb/-/docweb-display/docweb/9881490)

<!-- event: 2023-05-10; actors: Google; tags: model,product -->
### May 10, 2023 — PaLM 2 powers Google’s product counterattack

**Development.** Google released PaLM 2 in Gecko, Otter, Bison, and Unicorn sizes and put it across Bard, Workspace, security, and cloud products. **Technical change.** A more multilingual, code-heavy, and reasoning-oriented mixture of pretraining objectives improved efficiency relative to the much larger PaLM. Specialized Med-PaLM 2 and Sec-PaLM variants targeted regulated domains. **What it meant.** Google translated research into broad product deployment and emphasized a full family rather than one monolith. **Contemporary reaction.** The release reduced panic about Google’s technical position, although Bard still trailed ChatGPT in mindshare. **Power shift.** **Gained:** Google Cloud and Workspace. **Lost:** some Microsoft narrative momentum.

**Source:** [Google: PaLM 2](https://blog.google/innovation-and-ai/products/google-palm-2-ai-large-language-model/)

<!-- event: 2023-05-11; actors: Anthropic; tags: model,long-context -->
### May 11, 2023 — Claude moves to a 100K-token context window

**Development.** Anthropic expanded Claude’s context to roughly 75,000 words. **Technical change.** Users could place whole reports, books, or codebases into one prompt instead of relying on chunked retrieval, with a “needle” fact recalled from long documents. **What it meant.** Context length became a headline competitive dimension and a substitute—sometimes an expensive one—for retrieval infrastructure. **Contemporary reaction.** Enterprise users valued document analysis; researchers cautioned that maximum input length did not imply uniform attention or reasoning across it. **Power shift.** **Gained:** Anthropic and document-heavy workflows. **Lost:** OpenAI’s context lead and some early RAG middleware differentiation.

**Source:** [Anthropic: 100K context windows](https://www.anthropic.com/news/100k-context-windows)

<!-- event: 2023-06-13; actors: OpenAI; tags: tooling,function-calling,agents -->
### June 13, 2023 — OpenAI standardizes function calling

**Development.** GPT-4 and GPT-3.5 Turbo gained structured function calling; GPT-3.5 also gained a 16K variant. **Technical change.** Developers described functions with JSON Schema, and the model emitted machine-readable arguments rather than prose that applications had to parse. **What it meant.** Reliable tool routing moved into the model API and became the core primitive for production agents. **Contemporary reaction.** Developers embraced the reduction in brittle prompt parsing, while security engineers warned that valid JSON did not make an action truthful or authorized. **Power shift.** **Gained:** OpenAI’s developer platform and typed API ecosystems. **Lost:** bespoke parsers and some third-party orchestration glue.

**Source:** [OpenAI API update](https://openai.com/index/function-calling-and-other-api-updates/)

<!-- event: 2023-06-25; actors: Zhipu,Tsinghua; tags: model,open-weights,china -->
### June 25, 2023 — ChatGLM2-6B improves local Chinese deployment

**Development.** The ChatGLM team released its second 6B bilingual chat model. **Technical change.** It used a more efficient GLM architecture, 1.4 trillion training tokens, multi-query attention, 32K context, and substantially faster inference while retaining low-bit local deployment. **What it meant.** Chinese developers obtained an increasingly capable base model independent of U.S. APIs and accessible without a data-center cluster. **Contemporary reaction.** The family spread through domestic research and applications, even as top closed models remained stronger. **Power shift.** **Gained:** Zhipu’s ecosystem and local deployment. **Lost:** imported API dependence.

**Source:** [ChatGLM2 release repository](https://github.com/THUDM/ChatGLM2-6B)

<!-- event: 2023-07-06; actors: OpenAI; tags: tooling,code-interpreter -->
### July 6, 2023 — Code Interpreter turns chat into a sandboxed analytical computer

**Development.** OpenAI rolled Code Interpreter out to ChatGPT Plus and made the GPT-4 API generally available. **Technical change.** The model could write and execute Python in an isolated environment, iterate after errors, inspect uploaded files, calculate, chart, and return artifacts. **What it meant.** Execution let a model verify work and perform transformations it could not reliably simulate in tokens—a direct ancestor of today’s general agent computer environments. **Contemporary reaction.** Users called it a junior data analyst; limitations included session state, opaque packages, privacy concerns, and the model’s ability to misread successful-looking output. **Power shift.** **Gained:** OpenAI’s application layer. **Lost:** simple data-analysis wrappers and the “chat is only text” framing.

**Sources:** [OpenAI GPT-4 API availability](https://openai.com/index/gpt-4-api-general-availability/); [OpenAI Code Interpreter documentation](https://help.openai.com/en/articles/8437071-data-analysis-with-chatgpt)

<!-- event: 2023-07-11; actors: Anthropic; tags: model,long-context -->
### July 11, 2023 — Claude 2 becomes a public ChatGPT-class competitor

**Development.** Anthropic released Claude 2 in the U.S. and U.K. with web chat and API access. **Technical change.** The model improved coding, math, reasoning, safety, and 100K-context document work over Claude 1.3 while allowing much longer outputs. **What it meant.** Anthropic moved from partner-integrated model supplier to a direct consumer and developer brand. **Contemporary reaction.** Reviewers praised its writing and long-document behavior but found it more conservative and sometimes less capable than GPT-4. **Power shift.** **Gained:** Anthropic and customers seeking a second frontier provider. **Lost:** OpenAI’s uncontested premium-chat position.

**Source:** [Anthropic: Claude 2](https://www.anthropic.com/news/claude-2)

<!-- event: 2023-07-18; actors: Meta,Microsoft; tags: model,open-weights -->
### July 18, 2023 — Llama 2 makes open weights commercially deployable

**Development.** Meta released 7B, 13B, and 70B base and chat models with a custom commercial license and Microsoft as preferred cloud partner. **Technical change.** Models were trained on two trillion tokens; chat variants used supervised fine-tuning and RLHF, and context doubled to 4K. **What it meant.** Companies could fine-tune and self-host a strong modern LLM rather than pay per token, giving open weights a sustainable commercial center. **Contemporary reaction.** Developers celebrated access; critics objected that usage restrictions and a 700-million-user clause made “open source” inaccurate. **Power shift.** **Gained:** Meta, Azure, Hugging Face, cloud/GPU hosts, fine-tuning startups. **Lost:** closed API price power.

**Sources:** [Meta: Llama 2](https://about.fb.com/news/2023/07/llama-2/); [Llama 2 paper](https://ai.meta.com/research/publications/llama-2-open-foundation-and-fine-tuned-chat-models/)

<!-- event: 2023-08-03; actors: Alibaba,Qwen; tags: model,open-weights,china -->
### August 3, 2023 — Alibaba opens Qwen-7B and Qwen-7B-Chat

**Development.** Alibaba Cloud released the first public Qwen checkpoints, followed by Qwen-VL, Qwen-Audio, larger Qwen-14B/72B, and improved chat variants through the rest of 2023. **Technical change.** The family combined Chinese–English language competence with code, tool use, vision-language grounding, and later audio under progressively more permissive licenses. **What it meant.** Alibaba turned one model into an extensible multimodal open ecosystem and a distribution asset for ModelScope and its cloud. **Contemporary reaction.** Early attention was regional; rapid quality gains made Qwen one of the default bases for Chinese and global fine-tuning. **Power shift.** **Gained:** Alibaba/Qwen and China’s open-model stack. **Lost:** Meta’s near-monopoly on useful open weights.

**Sources:** [Qwen family overview](https://qwenlm.github.io/blog/qwen/); [Qwen-VL](https://qwenlm.github.io/blog/qwen-vl/)

<!-- event: 2023-08-15; actors: China; tags: regulation,china,generative-ai -->
### August 15, 2023 — China’s generative-AI rules take effect

**Development.** Interim Measures required public generative-AI providers to protect personal information, respect intellectual property, label some generated content, address illegal outputs, and comply with security/filing requirements. **Technical change.** Compared with the harsher draft, final rules focused on services offered to the public and explicitly paired control with state support for innovation. **What it meant.** China created the first binding national regime aimed specifically at generative AI, coupling content governance with industrial policy. **Contemporary reaction.** Firms welcomed more workable scope but still faced censorship, registration, and data obligations foreign rivals could not easily satisfy. **Power shift.** **Gained:** CAC and approved domestic providers. **Lost:** unregistered services and foreign platforms.

**Sources:** [Chinese government notice](https://english.www.gov.cn/news/202307/13/content_WS64aff5b3c6d0868f4e8ddc01.html); [CAC text](https://www.cac.gov.cn/2023-07/13/c_1690898327029107.htm)

<!-- event: 2023-09-27; actors: Mistral AI; tags: model,open-weights,efficiency -->
### September 27, 2023 — Mistral 7B gives Europe a high-quality open model company

**Development.** Four-month-old Mistral AI released a 7.3B Apache-2.0 model. **Technical change.** Grouped-query attention reduced inference memory and sliding-window attention handled sequences efficiently; the small model beat Llama 2 13B on many benchmarks. **What it meant.** Strong architecture and data could outrun parameter scale, and a European startup could compete globally without first shipping a giant model. **Contemporary reaction.** The release was embraced by local-LLM developers and validated Mistral’s large seed valuation. **Power shift.** **Gained:** Mistral, Europe, permissive open-weight deployment. **Lost:** Meta’s mindshare among compact-model users.

**Source:** [Mistral: Mistral 7B](https://mistral.ai/news/announcing-mistral-7b/)

<!-- event: 2023-10; actors: Moonshot AI; tags: model,long-context,china -->
### October 2023 — Moonshot AI launches Kimi Chat with 128K context

**Development.** Beijing startup Moonshot AI launched Kimi, initially distinguished by processing roughly 200,000 Chinese characters in a conversation. **Technical change.** Long-context attention and document ingestion targeted research, legal, financial, and office workflows rather than only casual chat. **What it meant.** A new Chinese lab acquired a clear product wedge—long documents—and a consumer feedback loop independent of the better-funded internet giants. **Contemporary reaction.** Demand surged as users tested entire reports and books, establishing Kimi as a national challenger. **Power shift.** **Gained:** Moonshot AI and long-context workflows. **Lost:** Baidu, Alibaba, and Zhipu mindshare at the consumer edge.

**Sources:** [Moonshot/Kimi research and release index](https://www.kimi.com/en/blog/); [Kimi technical reports](https://github.com/MoonshotAI)

<!-- event: 2023-10-17; actors: United States,China,NVIDIA; tags: regulation,export-controls -->
### October 17, 2023 — The U.S. closes chip-control workarounds

**Development.** BIS updated the 2022 rules to capture NVIDIA’s China-specific A800/H800-class products, more manufacturing equipment, additional destinations, and evasion routes. **Technical change.** A performance-density threshold replaced reliance on interconnect bandwidth and aimed to cover future workaround designs. **What it meant.** Export control became an iterative technical contest, with each accelerator SKU and training topology potentially altering legal access. **Contemporary reaction.** China condemned containment; NVIDIA warned that abrupt restrictions could harm its competitive position while preparing lower-spec parts. **Power shift.** **Gained:** BIS’s reach and domestic Chinese accelerator incentives. **Lost:** NVIDIA China revenue flexibility and Chinese frontier labs’ supply certainty.

**Source:** [BIS October 2023 rules](https://www.bis.gov/press-release/commerce-strengthens-restrictions-advanced-computing-semiconductors-semiconductor-manufacturing-equipment)

<!-- event: 2023-10-30; actors: United States,G7; tags: regulation,safety -->
### October 30, 2023 — U.S. executive order and G7 code put frontier models under formal oversight

**Development.** President Biden signed Executive Order 14110 as the G7 published its Hiroshima Process code for advanced AI developers. **Technical change.** The U.S. order used the Defense Production Act to require certain developers to report large training runs and safety-test results, tasked NIST with standards, and addressed biosecurity, cybersecurity, civil rights, procurement, labor, and content authentication. **What it meant.** Voluntary commitments began hardening into federal reporting and evaluation infrastructure. **Contemporary reaction.** Safety advocates welcomed breadth but questioned thresholds and enforcement; industry preferred the executive approach to premature legislation. **Power shift.** **Gained:** the White House, NIST, Commerce, and model-evaluation institutions. **Lost:** secrecy around the largest training runs.

**Sources:** [White House budgetary/legal record for EO 14110](https://www.whitehouse.gov/wp-content/uploads/2023/10/AI-EO-BIS.pdf); [G7 Hiroshima Process code](https://digital-strategy.ec.europa.eu/en/library/hiroshima-process-international-code-conduct-advanced-ai-systems)

<!-- event: 2023-11-01; actors: United Kingdom,China,United States,European Union; tags: regulation,safety,diplomacy -->
### November 1–2, 2023 — The Bletchley Declaration creates a frontier-safety diplomatic track

**Development.** Twenty-eight governments and the EU—including China and the United States—agreed that frontier AI could pose severe, even catastrophic, risks and warranted shared research, evaluation, and governance. **Technical change.** The summit established government access to pre-deployment model testing as an international objective and launched recurring scientific reporting. **What it meant.** Frontier safety briefly became a domain of great-power cooperation despite the chip war. **Contemporary reaction.** Inclusion of China was treated as a diplomatic success; critics noted that the declaration was nonbinding and vague. **Power shift.** **Gained:** the U.K. AI Safety Institute and external evaluators. **Lost:** labs’ claim that self-evaluation alone was sufficient.

**Sources:** [Bletchley Declaration](https://www.gov.uk/government/publications/ai-safety-summit-2023-the-bletchley-declaration); [summit testing outcomes](https://www.aisi.gov.uk/blog/ai-safety-summit-2023)

<!-- event: 2023-11-06; actors: OpenAI; tags: model,tooling,platform -->
### November 6, 2023 — OpenAI DevDay launches GPT-4 Turbo, custom GPTs, and Assistants API

**Development.** OpenAI bundled a 128K GPT-4 Turbo, lower prices, JSON mode, parallel function calls, reproducible outputs, updated knowledge, DALL·E 3, TTS, Whisper v3, GPTs, and the Assistants API. **Technical change.** Hosted threads, retrieval, Code Interpreter, tools, and instruction packages moved stateful agent infrastructure onto OpenAI’s platform. **What it meant.** OpenAI tried to own both the frontier model and the application runtime, while natural-language-configured GPTs lowered the barrier to building assistants. **Contemporary reaction.** Developers were enthusiastic about price and context but feared their startups had been absorbed as features. **Power shift.** **Gained:** OpenAI’s platform and non-coders. **Lost:** “wrapper” startups, some orchestration vendors, and rival APIs without hosted tools.

**Sources:** [OpenAI DevDay announcements](https://openai.com/index/new-models-and-developer-products-announced-at-devday/); [OpenAI: GPTs](https://openai.com/index/introducing-gpts/)

<!-- event: 2023-11-13; actors: NVIDIA; tags: hardware,gpu,memory -->
### November 13, 2023 — NVIDIA introduces H200

**Development.** NVIDIA refreshed Hopper with HBM3e memory. **Technical change.** H200 increased accelerator memory to 141 GB and bandwidth to 4.8 TB/s, allowing larger models and KV caches to fit with less communication. **What it meant.** Memory capacity and bandwidth—not only tensor FLOPS—became decisive for long-context and high-throughput inference. **Contemporary reaction.** Cloud and server partners committed quickly; the product also showed NVIDIA could extend a winning architecture before Blackwell. **Power shift.** **Gained:** NVIDIA, HBM supplier SK hynix, and clouds securing early inventory. **Lost:** rivals whose nominal compute lacked comparable memory systems.

**Source:** [NVIDIA H200 announcement](https://nvidianews.nvidia.com/news/nvidia-h200-tensor-core-gpu)

<!-- event: 2023-11-15; actors: Microsoft; tags: hardware,custom-silicon -->
### November 15, 2023 — Microsoft unveils Maia 100 and Cobalt 100

**Development.** Microsoft announced its first in-house AI accelerator and Arm server CPU. **Technical change.** Maia 100 was co-designed with OpenAI for Azure AI workloads, paired with a custom liquid-cooled server and network architecture; Cobalt targeted general cloud efficiency. **What it meant.** Even NVIDIA’s largest customers intended to own silicon and system design to control cost, capacity, and workload optimization. **Contemporary reaction.** The move was seen as long-term NVIDIA leverage rather than an immediate CUDA replacement. **Power shift.** **Gained:** Microsoft’s vertical integration and Marvell/TSMC-style custom silicon ecosystems. **Lost:** some future NVIDIA pricing power and x86 exclusivity.

**Source:** [Microsoft custom silicon announcement](https://news.microsoft.com/source/features/ai/in-house-chips-silicon-to-service-to-meet-ai-demand/)

<!-- event: 2023-11-17; actors: OpenAI,Microsoft; tags: company,governance -->
### November 17–29, 2023 — OpenAI’s board fires and reinstates Sam Altman

**Development.** The nonprofit board removed Altman for not being “consistently candid”; employee revolt, investor pressure, and Microsoft’s offer to hire the team led to his return and a largely replaced board. **Technical change.** None to the models; the change was governance under frontier-scale capital pressure. **What it meant.** The episode showed that formal nonprofit control could be overwhelmed by employee mobility, compute dependency, and a strategic investor. Microsoft obtained a nonvoting board-observer path, and commercialization advocates emerged stronger. **Contemporary reaction.** The week was treated as both corporate farce and a constitutional crisis for AI governance. **Power shift.** **Gained:** Altman, employees, Microsoft, growth priorities. **Lost:** the former board, effective-altruist influence, and confidence in the capped-profit structure’s checks.

**Sources:** [OpenAI removal statement](https://openai.com/index/openai-announces-leadership-transition/); [OpenAI: Altman returns](https://openai.com/index/sam-altman-returns-as-ceo-openai-has-a-new-initial-board/)

<!-- event: 2023-11-21; actors: Anthropic; tags: model,long-context,tool-use -->
### November 21, 2023 — Claude 2.1 doubles context to 200K

**Development.** Anthropic released Claude 2.1 with a 200K window, lower hallucination rates, system prompts, and beta tool use. **Technical change.** The update targeted enterprise reliability: Anthropic reported fewer false statements and fewer claims that absent material appeared in a supplied document. **What it meant.** Long context matured from spectacle into document-grounded enterprise infrastructure, and Claude gained the primitives for tools before its public computer-use push. **Contemporary reaction.** The enormous window drew praise, while “lost in the middle” tests across the field tempered claims about usable context. **Power shift.** **Gained:** Anthropic and cloud partners AWS/Google. **Lost:** smaller-context rivals and naïve retrieval-only stacks.

**Source:** [Anthropic: Claude 2.1](https://www.anthropic.com/news/claude-2-1)

<!-- event: 2023-12-06; actors: Google; tags: model,multimodal,hardware -->
### December 6, 2023 — Google releases Gemini 1.0 in Ultra, Pro, and Nano tiers

**Development.** Google DeepMind introduced Gemini, with Pro powering Bard, Nano running on devices, and Ultra reserved for later release. **Technical change.** Gemini was trained from the outset across text, images, audio, video, and code rather than attaching separate perception modules; TPU v4 and v5e trained the family. **What it meant.** Google unified Brain and DeepMind’s model effort and used its full stack—research, TPUs, Android, Search, Workspace, and Cloud—to reenter the frontier race. **Contemporary reaction.** Benchmark claims suggested Ultra could beat GPT-4, but a highly edited demo and delayed access produced skepticism. **Power shift.** **Gained:** Google DeepMind and on-device AI. **Lost:** Bard/PaLM branding and some trust in launch marketing.

**Source:** [Google: Gemini 1.0](https://blog.google/innovation-and-ai/technology/ai/google-gemini-ai/)

<!-- event: 2023-12-06; actors: AMD; tags: hardware,gpu,open-software -->
### December 6, 2023 — AMD ships MI300X and ROCm 6

**Development.** AMD made its Instinct MI300X accelerator and MI300A CPU–GPU APU available with commitments from Microsoft, Meta, Oracle, and major server vendors. **Technical change.** MI300X used chiplets, 192 GB of HBM3, 5.3 TB/s bandwidth, FP8, and an eight-accelerator 1.5 TB platform; ROCm 6 improved the software path for PyTorch, vLLM, and FlashAttention. **What it meant.** AMD finally fielded a credible memory-rich alternative for large-model inference and some training. **Contemporary reaction.** Customers welcomed supply and price competition, but CUDA maturity remained the central objection. **Power shift.** **Gained:** AMD and hyperscalers seeking leverage. **Lost:** a measure of NVIDIA’s hardware monopoly, not its software moat.

**Source:** [AMD MI300 launch](https://www.amd.com/en/newsroom/press-releases/2023-12-6-amd-delivers-leadership-portfolio-of-data-center-a.html)

<!-- event: 2023-12-08; actors: European Union; tags: regulation,eu -->
### December 8, 2023 — EU negotiators reach a political deal on the AI Act

**Development.** Parliament and Council negotiators agreed on the law’s final architecture, adding general-purpose AI and systemic-risk model obligations after ChatGPT changed the legislative facts. **Technical change.** Providers of powerful general-purpose models would face documentation, copyright-policy, evaluation, incident-reporting, cybersecurity, and systemic-risk duties; prohibited and high-risk uses retained stricter controls. **What it meant.** The “Brussels effect” moved upstream from applications into foundation-model governance. **Contemporary reaction.** European leaders called it historic; rights groups warned about law-enforcement exceptions, and model developers objected to uncertain thresholds and cost. **Power shift.** **Gained:** EU institutions and compliance-capable incumbents. **Lost:** opaque model development and smaller EU firms facing fixed compliance costs.

**Source:** [European Parliament political agreement](https://www.europarl.europa.eu/news/en/press-room/20231206IPR15699/artificial-intelligence-act-deal-on-comprehensive-rules-for-trustworthy-ai)

<!-- event: 2023-12-11; actors: Mistral AI; tags: model,moe,open-weights -->
### December 11, 2023 — Mixtral 8×7B validates sparse mixture-of-experts for open models

**Development.** Mistral released an Apache-2.0 sparse mixture-of-experts model via a magnet link before publishing details. **Technical change.** Each token routed through two of eight feed-forward experts, giving about 46.7B total parameters but roughly 12.9B active per token, with 32K context. **What it meant.** MoE offered high quality without paying dense-model compute on every token and became central to later Qwen, DeepSeek, Kimi, and GLM designs. **Contemporary reaction.** The unconventional release delighted open-source developers; its memory footprint reminded users that low active compute did not mean small weights. **Power shift.** **Gained:** Mistral and MoE inference stacks. **Lost:** dense scaling as the only accepted route.

**Source:** [Mistral: Mixtral of Experts](https://mistral.ai/news/mixtral-of-experts/)

---

# 2024 — Native multimodality, long context, open weights, and the first computer-using agents

<!-- event: 2024-01-16; actors: Zhipu; tags: model,agents,china -->
### January 16, 2024 — Zhipu launches the GLM-4 generation

**Development.** Zhipu introduced GLM-4, later extending the family with GLM-4-Air, 9B open weights, vision, and “All Tools” agent variants. **Technical change.** The generation substantially improved Chinese/English reasoning, coding, long context, multimodal understanding, and autonomous use of web browsing, Python, and APIs. **What it meant.** Zhipu progressed from the academic ChatGLM line to a full commercial frontier platform and one of China’s designated “AI tiger” companies. **Contemporary reaction.** Domestic benchmarks and a low-cost Flash tier drove adoption, while U.S. observers increasingly treated Zhipu as a strategic—not merely commercial—competitor. **Power shift.** **Gained:** Zhipu and Chinese enterprise buyers. **Lost:** Baidu/Alibaba’s unchallenged domestic platform position and reliance on Western agents.

**Source:** [GLM-4 technical report](https://arxiv.org/abs/2406.12793)

<!-- event: 2024-02-04; actors: Alibaba,Qwen; tags: model,open-weights -->
### February 4–April 25, 2024 — Qwen 1.5 scales from 0.5B to 110B and MoE

**Development.** Alibaba released Qwen 1.5 across compact, dense, and mixture-of-experts checkpoints, culminating in Qwen1.5-110B; upgraded Qwen-VL Max/Plus served vision users. **Technical change.** Native Hugging Face support, stronger multilingual chat, 32K context, quantized variants, and a small sparse MoE made one consistent family deployable from edge devices to servers. **What it meant.** Breadth and tooling, not only a single leaderboard winner, became Qwen’s durable advantage. **Contemporary reaction.** Developers praised the permissive releases and size ladder; concerns persisted around licenses for some large variants and Chinese content controls in hosted services. **Power shift.** **Gained:** Alibaba/ModelScope and device-to-cloud deployers. **Lost:** Llama’s default status in non-Western open deployments.

**Sources:** [Qwen 1.5](https://qwenlm.github.io/blog/qwen1.5/); [Qwen1.5-110B](https://qwenlm.github.io/blog/qwen1.5-110b/); [Qwen-VL updates](https://qwenlm.github.io/blog/qwen-vl/)

<!-- event: 2024-02-08; actors: Google; tags: model,product,multimodal -->
### February 8, 2024 — Bard becomes Gemini; Ultra 1.0 ships in Gemini Advanced

**Development.** Google retired the Bard name, released a Gemini mobile app, and put its largest model behind a Google One subscription. **Technical change.** Ultra delivered Google’s strongest reasoning, coding, and native multimodal capability, while Nano and Pro covered device and mass-market tiers. **What it meant.** One model brand now spanned consumer assistant, Android, Workspace, and Cloud, correcting Google’s fragmented launch. **Contemporary reaction.** Reviewers saw a credible GPT-4 rival but criticized product naming, geographic limits, and image-generation errors that led Google to pause people generation later that month. **Power shift.** **Gained:** Gemini as a unified brand and Google subscription distribution. **Lost:** Bard and some trust in Google’s safety/quality tuning.

**Source:** [Google: Bard becomes Gemini](https://blog.google/intl/en-africa/products/explore-get-answers/bard-becomes-gemini-try-ultra-10-and-a-new-mobile-app-today/)

<!-- event: 2024-02-15; actors: Google,OpenAI; tags: model,long-context,video -->
### February 15, 2024 — Gemini 1.5 Pro and Sora reveal two different scaling frontiers

**Development.** Google previewed Gemini 1.5 Pro with a one-million-token context; OpenAI previewed Sora text-to-video. **Technical change.** Gemini used a sparse mixture-of-experts architecture and could reason across roughly an hour of video, 11 hours of audio, or huge codebases. Sora treated compressed video patches as tokens in a diffusion Transformer, generating coherent minute-long scenes. **What it meant.** Context and world simulation joined model scale as frontier dimensions. **Contemporary reaction.** Gemini’s needle-in-a-haystack demos reset expectations for context; Sora produced awe and immediate deepfake/creative-labor anxiety, though access stayed restricted. **Power shift.** **Gained:** Google on long context and OpenAI on generative video narrative. **Lost:** short-context APIs and video startups’ perceived lead.

**Sources:** [Google: Gemini 1.5](https://blog.google/innovation-and-ai/products/google-gemini-next-generation-model-february-2024/); [OpenAI: Sora](https://openai.com/index/sora/)

<!-- event: 2024-02-21; actors: Google; tags: model,open-weights,edge -->
### February 21, 2024 — Google releases Gemma 2B and 7B open weights

**Development.** Google shipped compact models derived from Gemini research with responsible-generation tooling and deployment recipes. **Technical change.** Gemma brought a modern decoder architecture, broad tokenizer, safety filtering guidance, and optimized runtimes for laptops, workstations, and cloud GPUs. **What it meant.** Google entered the open-weight contest it had largely ceded to Meta and Mistral and used openness to strengthen JAX, Keras, PyTorch, Hugging Face, and Vertex distribution. **Contemporary reaction.** The models were efficient and accessible, but the custom license and small initial sizes limited claims of frontier openness. **Power shift.** **Gained:** Google’s developer ecosystem. **Lost:** Meta/Mistral exclusivity over credible open families.

**Source:** [Google: Gemma](https://blog.google/innovation-and-ai/technology/developers-tools/gemma-open-models/)

<!-- event: 2024-02-26; actors: Mistral AI,Microsoft; tags: model,company,closed-model -->
### February 26, 2024 — Mistral Large launches as Microsoft invests

**Development.** Mistral released a proprietary flagship through its own platform and Azure while Microsoft took a small equity stake. **Technical change.** Mistral Large added strong multilingual reasoning, coding, and native function calling; the Le Chat assistant gave it a consumer interface. **What it meant.** Mistral adopted a dual strategy—permissive small/open models plus paid closed frontier models—and gained hyperscaler distribution. **Contemporary reaction.** Europe celebrated a homegrown challenger, but critics questioned whether an Azure deal weakened the case for European strategic autonomy. **Power shift.** **Gained:** Mistral and Azure’s multi-model catalog. **Lost:** the expectation that Mistral would remain purely open.

**Source:** [Mistral: Mistral Large](https://mistral.ai/news/mistral-large/)

<!-- event: 2024-03-04; actors: Anthropic; tags: model,multimodal -->
### March 4–13, 2024 — Claude 3 Opus, Sonnet, and Haiku establish a complete tiered family

**Development.** Anthropic released three multimodal models: Opus for maximum intelligence, Sonnet for balance, and Haiku for speed/cost. **Technical change.** All accepted images, improved instruction following and refusal calibration, supported 200K context, and used tier-specific latency/economics; Opus led major benchmarks at release. **What it meant.** Anthropic briefly took the perceived frontier lead from GPT-4 and showed that a coherent price/performance ladder was an enterprise advantage. **Contemporary reaction.** Opus received exceptional reviews for reasoning and prose; Haiku’s speed made Claude viable for high-volume use. **Power shift.** **Gained:** Anthropic, AWS Bedrock, Google Vertex. **Lost:** OpenAI’s uncontested quality lead and single-model pricing strategies.

**Sources:** [Anthropic: Claude 3 family](https://www.anthropic.com/news/claude-3-family); [Anthropic: Claude 3 Haiku](https://www.anthropic.com/news/claude-3-haiku)

<!-- event: 2024-03-05; actors: Taalas; tags: hardware,inference,startup -->
### March 5, 2024 — Taalas emerges with a model-to-silicon thesis

**Development.** The Toronto startup disclosed $50 million in funding and a “direct-to-silicon foundry” plan. **Technical change.** Instead of a broadly programmable accelerator, Taalas proposed compiling model architecture and weights into hardened silicon, removing HBM weight movement and much control overhead. **What it meant.** It revived extreme specialization as a possible answer to inference cost—accepting model inflexibility in exchange for tokens per watt and per dollar. **Contemporary reaction.** Experienced-chip-team credentials generated interest, but 1,000× cost-improvement language was treated as an unproven claim. **Power shift.** **Gained:** specialized inference as an investable category. **Lost:** none yet; GPUs retained the flexibility advantage.

**Source:** [Taalas funding and architecture announcement](https://www.prnewswire.com/news-releases/taalas-emerges-from-stealth-with-50-million-in-funding-and-a-groundbreaking-silicon-ai-technology-302079053.html)

<!-- event: 2024-03-12; actors: Cognition; tags: agents,coding,tooling -->
### March 12, 2024 — Devin packages the software-engineering agent

**Development.** Cognition previewed Devin as an autonomous software engineer with its own shell, browser, editor, and sandbox. **Technical change.** Persistent state, planning, error recovery, and an integrated execution environment let one model attempt thousands of steps and submit completed work rather than suggestions. **What it meant.** Coding assistants moved from inline completion toward asynchronous delegation; SWE-bench became a commercial benchmark. **Contemporary reaction.** The 13.86% unassisted SWE-bench claim and polished demos went viral, followed by scrutiny of task selection, failures, and the “replace engineers” framing. **Power shift.** **Gained:** Cognition and agent harnesses. **Lost:** completion-only coding tools and confidence in demos without reproducible traces.

**Source:** [Cognition: Introducing Devin](https://cognition.com/blog/introducing-devin)

<!-- event: 2024-03-13; actors: Cerebras; tags: hardware,wafer-scale -->
### March 13, 2024 — Cerebras WSE-3 doubles wafer-scale performance

**Development.** Cerebras introduced the 5-nanometer WSE-3 and CS-3 system. **Technical change.** One wafer carried four trillion transistors, 900,000 cores, 44 GB on-chip SRAM, and a claimed 125 petaflops, scaling to 2,048 systems without conventional GPU model partitioning. **What it meant.** Cerebras remained the most radical shipped alternative to GPU clusters and built a path from training toward ultra-fast inference. **Contemporary reaction.** The specifications drew renewed respect, while customer concentration, proprietary software, and NVIDIA ecosystem risk constrained adoption. **Power shift.** **Gained:** Cerebras and G42’s Condor Galaxy installations. **Lost:** the presumption that package-level chiplets were the only manufacturable scale strategy.

**Source:** [Cerebras WSE-3 announcement](https://www.cerebras.ai/press-release/cerebras-announces-third-generation-wafer-scale-engine)

<!-- event: 2024-03-18; actors: NVIDIA,TSMC; tags: hardware,gpu,networking -->
### March 18, 2024 — NVIDIA Blackwell turns the rack into the computer

**Development.** NVIDIA announced B100/B200, the GB200 Grace Blackwell Superchip, and liquid-cooled GB200 NVL72 systems. **Technical change.** Two reticle-limited dies acted as one GPU over a 10 TB/s link; FP4 Tensor Cores, fifth-generation NVLink, 192 GB HBM3e per B200, RAS engines, decompression, and 800 Gb/s Quantum-X/Spectrum-X networking targeted trillion-parameter inference. **What it meant.** NVIDIA’s unit of competition moved from a chip to a 72-GPU rack and full “AI factory,” increasing customer dependence on its networking, CPUs, software, and thermal design. **Contemporary reaction.** Demand was immediate, though heat, liquid cooling, packaging yield, and rollout delays raised deployment risk. **Power shift.** **Gained:** NVIDIA, TSMC CoWoS, HBM, power/cooling suppliers. **Lost:** merchant component modularity and smaller infrastructure buyers.

**Sources:** [NVIDIA Blackwell platform](https://nvidianews.nvidia.com/news/nvidia-blackwell-platform-arrives-to-power-a-new-era-of-computing); [GB200 DGX SuperPOD](https://nvidianews.nvidia.com/news/nvidia-blackwell-dgx-generative-ai-supercomputing)

<!-- event: 2024-03-19; actors: Microsoft,Inflection AI; tags: company,talent,antitrust -->
### March 19, 2024 — Microsoft hires Inflection’s founders and licenses its models

**Development.** Mustafa Suleyman, Karén Simonyan, and most of Inflection’s staff joined a new Microsoft AI organization; Microsoft paid for model access while Inflection continued under new leadership. **Technical change.** No public architecture leap—the innovation was a transaction that transferred scarce talent and IP without a conventional acquisition. **What it meant.** “Reverse acquihires” became a method for hyperscalers to absorb frontier teams while attempting to avoid full merger review. **Contemporary reaction.** The deal was seen as a rescue for Inflection investors and a warning to standalone labs; U.S. and U.K. regulators examined it. **Power shift.** **Gained:** Microsoft’s consumer-AI control. **Lost:** Inflection’s independence and investors’ original product thesis.

**Source:** [Microsoft leadership announcement](https://blogs.microsoft.com/blog/2024/03/19/mustafa-suleyman-deepmind-and-inflection-co-founder-joins-microsoft-to-lead-copilot/)

<!-- event: 2024-03-21; actors: United Nations; tags: regulation,global -->
### March 21, 2024 — The U.N. General Assembly adopts its first AI resolution

**Development.** Member states unanimously backed a U.S.-led resolution on safe, secure, trustworthy AI and equitable access. **Technical change.** The nonbinding text called for human-rights safeguards, capacity building, interoperable standards, and closing digital divides. **What it meant.** Global AI governance broadened beyond frontier-risk clubs to development, inclusion, and rights—priorities of countries without giant compute clusters. **Contemporary reaction.** Consensus was welcomed as a diplomatic baseline; the lack of enforcement and military-AI coverage limited practical effect. **Power shift.** **Gained:** U.N. legitimacy and Global South demands. **Lost:** the idea that a handful of frontier states could define the whole agenda.

**Source:** [United Nations resolution coverage and text](https://news.un.org/en/story/2024/03/1147831)

<!-- event: 2024-03-27; actors: Databricks,MosaicML; tags: model,open-weights,moe -->
### March 27–28, 2024 — DBRX and Jamba expand open architecture choices

**Development.** Databricks released DBRX, a 132B/36B-active MoE, and AI21 released Jamba, a 52B/12B-active hybrid Transformer–Mamba model with 256K context. **Technical change.** DBRX used fine-grained expert routing and enterprise-oriented data governance; Jamba alternated attention and state-space layers to reduce KV-cache memory while retaining tool-friendly Transformer behavior. **What it meant.** Architecture exploration moved beyond dense Transformers, and enterprise vendors used open weights to drive platforms. **Contemporary reaction.** Both were praised as technically bold; serving complexity and weaker ecosystem support limited immediate displacement of Llama/Mixtral. **Power shift.** **Gained:** Databricks, AI21, Mamba/SSM research. **Lost:** architectural monoculture.

**Sources:** [Databricks: DBRX](https://www.databricks.com/blog/introducing-dbrx-new-state-art-open-llm); [AI21: Jamba](https://www.ai21.com/blog/announcing-jamba/)

<!-- event: 2024-04-08; actors: TSMC,United States; tags: hardware,foundry,industrial-policy -->
### April 8, 2024 — TSMC expands Arizona and wins proposed CHIPS support

**Development.** TSMC raised planned Arizona investment above $65 billion, added a third leading-edge fab, and reached terms for up to $6.6 billion in direct CHIPS funding plus loans. **Technical change.** Plans extended the site from N4 to 3 nm and 2 nm-class production, though advanced packaging still largely remained in Taiwan at this stage. **What it meant.** The United States bought partial geographic resilience in the foundry layer on which NVIDIA, AMD, Apple, and custom AI chips depended. **Contemporary reaction.** Policymakers celebrated; skeptics noted higher U.S. costs, workforce challenges, and a multiyear timetable. **Power shift.** **Gained:** TSMC, Arizona, U.S. industrial policy. **Lost:** some—though far from all—Taiwan-only concentration risk.

**Source:** [TSMC Arizona and CHIPS announcement](https://pr.tsmc.com/english/news/3122)

<!-- event: 2024-04-18; actors: Meta; tags: model,open-weights -->
### April 18, 2024 — Llama 3 raises the open-weight baseline

**Development.** Meta released 8B and 70B pretrained and instruction-tuned models, with larger variants promised. **Technical change.** More than 15 trillion training tokens, a 128K-token vocabulary, grouped-query attention, improved filtering, and extensive preference data produced strong efficiency and instruction following; initial context was 8K. **What it meant.** Meta’s distribution across clouds, hardware, and repositories made Llama a de facto open ecosystem standard. **Contemporary reaction.** Developers praised 70B quality and 8B local usability, while the custom license and undisclosed data remained concerns. **Power shift.** **Gained:** Meta, open fine-tuners, and inference hosts. **Lost:** smaller open families that could not match distribution.

**Source:** [Meta: Llama 3](https://ai.meta.com/blog/meta-llama-3/)

<!-- event: 2024-04-24; actors: TSMC; tags: hardware,foundry,packaging -->
### April 24, 2024 — TSMC unveils A16 and System-on-Wafer

**Development.** TSMC announced a 2026 A16 process and wafer-scale system integration. **Technical change.** A16 combined gate-all-around nanosheet transistors with backside “Super Power Rail,” promising 8–10% higher speed or 15–20% lower power than N2P and better density for data-center chips; SoW extended integration beyond conventional packages. **What it meant.** Foundry roadmaps were increasingly shaped by AI power delivery, chiplets, and system scale rather than smartphone logic alone. **Contemporary reaction.** Customers saw an answer to Intel’s backside-power pitch and escalating accelerator size; execution and packaging capacity remained the bottlenecks. **Power shift.** **Gained:** TSMC’s technology leadership. **Lost:** Intel Foundry’s differentiation and designers without access to leading packaging slots.

**Source:** [TSMC 2024 technology symposium](https://pr.tsmc.com/english/news/3136)

<!-- event: 2024-05-06; actors: DeepSeek; tags: model,moe,china,open-weights -->
### May 6, 2024 — DeepSeek-V2 attacks the cost structure

**Development.** DeepSeek released a 236B-parameter, 21B-active MoE model and dramatically cut its API price. **Technical change.** Multi-head Latent Attention compressed keys/values and DeepSeekMoE routed fine-grained shared/specialized experts; the team reported 42.5% lower training cost, 93.3% smaller KV cache, and up to 5.76× generation throughput versus its predecessor. **What it meant.** Memory engineering and sparse activation—not privileged access to the newest chips—could reset both training and serving economics. A domestic Chinese price war followed. **Contemporary reaction.** Initially underappreciated outside China, V2 became the architectural foundation for the V3/R1 shock. **Power shift.** **Gained:** DeepSeek, efficient open models, API buyers. **Lost:** high-margin Chinese model APIs and dense-model assumptions.

**Source:** [DeepSeek-V2 repository and paper](https://github.com/deepseek-ai/DeepSeek-V2)

<!-- event: 2024-05-13; actors: OpenAI; tags: model,multimodal,realtime -->
### May 13, 2024 — GPT-4o makes multimodality native and real time

**Development.** OpenAI released “omni,” a single model for text, vision, and audio, initially with text/image outputs and staged voice/video rollout. **Technical change.** It processed and generated modalities end to end instead of chaining speech recognition, text reasoning, and speech synthesis; audio response averaged 320 ms. API text was twice as fast, half the price, and rate-limited higher than GPT-4 Turbo. **What it meant.** Latency, prosody, interruption, and visual awareness made AI feel like a live collaborator rather than a turn-based chatbot. **Contemporary reaction.** The voice demo drew both amazement and comparisons to *Her*; staged safety review and a voice resembling Scarlett Johansson generated controversy. **Power shift.** **Gained:** OpenAI’s consumer product and real-time API. **Lost:** separate speech/vision pipelines and Google’s opportunity to own multimodal assistants.

**Source:** [OpenAI: GPT-4o](https://openai.com/index/hello-gpt-4o/)

<!-- event: 2024-05-14; actors: Google; tags: model,hardware,agents -->
### May 14, 2024 — Google I/O introduces Gemini 1.5 Flash, Project Astra, Veo, and Trillium TPU

**Development.** Google released a distilled low-latency Flash model, improved 1.5 Pro, previewed a two-million-token window, showed the live multimodal Astra assistant, unveiled Veo video generation, and announced sixth-generation Trillium TPU. **Technical change.** Flash optimized high-volume serving; Astra streamed audio/video with memory; Trillium delivered a claimed 4.7× per-chip compute gain and stronger interconnect/memory. **What it meant.** Google’s answer was full-stack and visibly productized, spanning models, agents, media, search, devices, and silicon. **Contemporary reaction.** The breadth restored confidence, though many features were previews and naming remained complex. **Power shift.** **Gained:** Google’s integrated stack. **Lost:** the narrative that it had permanently missed the generative-AI transition.

**Sources:** [Google developer/model updates](https://blog.google/innovation-and-ai/technology/developers-tools/gemini-gemma-developer-updates-may-2024/); [Google I/O: Trillium TPU](https://blog.google/intl/en-africa/products/explore-get-answers/google-io-2024-an-io-for-a-new-generation/)

<!-- event: 2024-05-21; actors: European Union; tags: regulation,eu -->
### May 21, 2024 — EU Council gives final approval to the AI Act

**Development.** Member states completed the legislative process after Parliament’s March vote. **Technical change.** The final text established risk tiers, banned selected uses, mandated transparency for chatbots/deepfakes, and imposed special duties on general-purpose models and those above a systemic-risk compute threshold. **What it meant.** Model providers now had a multiyear compliance calendar with fines tied to global turnover. **Contemporary reaction.** Supporters called it the first comprehensive AI law; business groups worried Europe would regulate a technology it did not lead. **Power shift.** **Gained:** the EU AI Office, auditors, rights claimants. **Lost:** un documented high-risk deployers; EU startups potentially bore disproportionate fixed costs.

**Source:** [Council of the EU final approval](https://www.consilium.europa.eu/en/press/press-releases/2024/05/21/artificial-intelligence-ai-act-council-gives-final-green-light-to-the-first-worldwide-rules-on-ai/)

<!-- event: 2024-05-22; actors: South Korea,United Kingdom,frontier-labs; tags: regulation,safety -->
### May 21–22, 2024 — Seoul summit turns frontier safety into company commitments

**Development.** Sixteen companies, including U.S., Chinese, European, and Middle Eastern developers, promised safety frameworks, external evaluation, security, and release thresholds by the 2025 summit. **Technical change.** Firms committed to define intolerable-risk boundaries and, if mitigations failed, not develop or deploy a model. **What it meant.** Bletchley’s principles acquired company-specific implementation deadlines, though still without binding sanctions. **Contemporary reaction.** Cross-border participation was welcomed; skeptics questioned self-defined thresholds and whether commercial competition would override them. **Power shift.** **Gained:** safety institutes and evaluation norms. **Lost:** a small amount of labs’ unilateral release discretion.

**Sources:** [Frontier AI Safety Commitments](https://www.gov.uk/government/publications/frontier-ai-safety-commitments-ai-seoul-summit-2024/frontier-ai-safety-commitments-ai-seoul-summit-2024); [summit conclusion](https://www.gov.uk/government/news/new-commitmentto-deepen-work-on-severe-ai-risks-concludes-ai-seoul-summit)

<!-- event: 2024-06-07; actors: Alibaba,Qwen; tags: model,open-weights,multilingual -->
### June 7, 2024 — Qwen2 broadens languages, sizes, and context

**Development.** Alibaba released dense 0.5B–72B and sparse 57B-A14B models. **Technical change.** Training expanded beyond Chinese/English to 27 additional languages, with grouped-query attention, improved coding/math, and up to 128K context in selected variants. **What it meant.** Qwen shifted from a Chinese-language alternative to a global open foundation family competitive with Llama and Mistral. **Contemporary reaction.** The 72B model gained broad adoption and fine-tunes; U.S. policy concerns did little to slow open-weight downloads. **Power shift.** **Gained:** Qwen and multilingual developers. **Lost:** Western families’ language and ecosystem lead.

**Source:** [Qwen2 release](https://qwenlm.github.io/blog/qwen2/)

<!-- event: 2024-06-10; actors: Apple,OpenAI; tags: product,distribution,privacy -->
### June 10, 2024 — Apple Intelligence pairs on-device models with ChatGPT

**Development.** Apple announced system-level writing, image, notification, and Siri features, using private cloud compute for larger tasks and optional GPT-4o for requests Apple’s models could not handle. **Technical change.** Routing, on-device inference, privacy attestations, and permissioned external-model handoff became part of the consumer AI stack. **What it meant.** OpenAI gained access to Apple’s device distribution without becoming the default for every task; Apple admitted it needed a frontier partner. **Contemporary reaction.** Privacy architecture was praised, while the delayed rollout and modest Siri capability fed concern that Apple lagged. **Power shift.** **Gained:** OpenAI distribution and Apple’s privacy differentiation. **Lost:** Google’s default-assistant advantage and Apple’s aura of self-sufficiency.

**Source:** [Apple Intelligence announcement](https://www.apple.com/newsroom/2024/06/introducing-apple-intelligence-for-iphone-ipad-and-mac/)

<!-- event: 2024-06-21; actors: Anthropic; tags: model,artifacts,coding -->
### June 21, 2024 — Claude 3.5 Sonnet and Artifacts outperform at the middle tier

**Development.** Anthropic released Claude 3.5 Sonnet at the price and speed of Claude 3 Sonnet while surpassing Opus on many evaluations; Artifacts displayed code, documents, and designs beside chat. **Technical change.** Coding, visual reasoning, instruction following, and humor improved, while the artifact workspace created an iterative UI above the model. **What it meant.** A mid-priced model could obsolete a premium flagship, and editable outputs became as important as conversational responses. **Contemporary reaction.** Developers rapidly made Sonnet a coding favorite; Artifacts previewed the shift from chat to software creation. **Power shift.** **Gained:** Anthropic’s developer mindshare. **Lost:** Claude 3 Opus, GPT-4-class price premiums, and plain chat interfaces.

**Source:** [Anthropic: Claude 3.5 Sonnet](https://www.anthropic.com/news/claude-3-5-sonnet)

<!-- event: 2024-06-27; actors: Google; tags: model,open-weights -->
### June 27, 2024 — Gemma 2 brings stronger small and mid-size open models

**Development.** Google released 9B and 27B variants, later adding 2B. **Technical change.** Sliding-window/global attention interleaving, knowledge distillation, logit soft-capping, and extensive safety evaluations let 27B compete with models more than twice its size and 9B serve efficiently on limited hardware. **What it meant.** Distillation from proprietary teachers became a standard route to compact quality. **Contemporary reaction.** Developers praised performance-per-parameter; the Gemma license still prevented full open-source classification. **Power shift.** **Gained:** Google and efficient local inference. **Lost:** larger open models whose quality no longer justified serving cost.

**Source:** [Google: Gemma 2](https://blog.google/innovation-and-ai/technology/developers-tools/google-gemma-2/)

<!-- event: 2024-07-23; actors: Meta; tags: model,open-weights,long-context -->
### July 23, 2024 — Llama 3.1 405B becomes the first broadly available frontier-scale open weight

**Development.** Meta released 8B, 70B, and 405B models with 128K context, eight languages, and tool use. **Technical change.** The dense 405B model trained on more than 15 trillion tokens using over 16,000 H100s; Meta used FP8 inference and generated synthetic data for smaller models. **What it meant.** Developers could distill, fine-tune, and self-host a model competitive with leading closed APIs, while clouds and NVIDIA monetized deployment. **Contemporary reaction.** It was hailed as a milestone for open access, alongside criticism of the license, safety risk, and enormous serving requirements. **Power shift.** **Gained:** Meta’s ecosystem and hyperscaler hosts. **Lost:** closed labs’ exclusive access to frontier-class weights.

**Source:** [Meta: Llama 3.1](https://ai.meta.com/blog/meta-llama-3-1/)

<!-- event: 2024-07-24; actors: Mistral AI; tags: model,closed-model,multilingual -->
### July 24, 2024 — Mistral Large 2 and specialist models diversify the family

**Development.** Mistral launched a 123B flagship with 128K context after releasing Codestral, Mathstral, Codestral Mamba, and the 12B Mistral NeMo. **Technical change.** Large 2 emphasized multilingual code, function calling, and concise responses; specialists tested code licensing, state-space architecture, math post-training, and a new tokenizer. **What it meant.** Mistral competed through a portfolio and architecture experimentation rather than one general model. **Contemporary reaction.** Quality was strong, but noncommercial research licenses on the largest/specialist weights complicated its “open European champion” image. **Power shift.** **Gained:** Mistral and NVIDIA partnership. **Lost:** license simplicity and some open-source goodwill.

**Sources:** [Mistral Large 2](https://mistral.ai/news/mistral-large-2407/); [Mistral newsroom release index](https://mistral.ai/news/)

<!-- event: 2024-08-01; actors: European Union; tags: regulation,eu -->
### August 1, 2024 — The EU AI Act enters into force

**Development.** The final regulation became law, starting a staged application through 2027 and beyond. **Technical change.** Prohibited practices would apply in six months, general-purpose-model duties after one year, and most other rules after two years, backed by an AI Office and national authorities. **What it meant.** Providers needed training-data summaries, copyright policies, technical documentation, evaluations, security, and incident processes on an enforceable schedule. **Contemporary reaction.** Compliance programs accelerated; debate shifted from whether the law would pass to how the Commission would define systemic models and codes. **Power shift.** **Gained:** EU rulemaking and large providers able to absorb compliance. **Lost:** opaque release processes and Europe’s fastest-moving startups at the margin.

**Source:** [European Commission: AI Act enters into force](https://ec.europa.eu/commission/presscorner/api/files/document/print/en/ip_24_4123/IP_24_4123_EN.pdf)

<!-- event: 2024-08-09; actors: Alibaba,Qwen; tags: model,audio,multimodal -->
### August 9, 2024 — Qwen2-Audio unifies audio analysis and voice chat

**Development.** Alibaba released base and instruction-tuned audio-language models. **Technical change.** One model handled speech, natural sounds, music, and audio events, with an audio-analysis mode and direct voice-chat mode rather than requiring a separate speech recognizer. **What it meant.** Native audio competition widened beyond GPT-4o and Gemini, with open weights enabling research and local adaptation. **Contemporary reaction.** The release reinforced Qwen’s multimodal breadth, though real-time product quality still favored closed systems. **Power shift.** **Gained:** Qwen and open multimodal builders. **Lost:** modular ASR-plus-LLM stacks’ exclusivity.

**Source:** [Qwen2-Audio](https://qwenlm.github.io/blog/qwen2-audio/)

<!-- event: 2024-08-27; actors: Cerebras,Groq; tags: hardware,inference -->
### August 27, 2024 — Cerebras and Groq make token speed a product category

**Development.** Cerebras opened WSE-3-based inference, claiming 1,800 tokens/s for Llama 3.1 8B and 450 tokens/s for 70B; Groq’s deterministic LPU cloud had already popularized near-instant open-model responses. **Technical change.** Both reduced the memory-movement and scheduling overhead that makes GPU autoregressive decode latency-bound—Cerebras with wafer-scale SRAM/bandwidth, Groq with compiler-scheduled tensor streaming. **What it meant.** Per-user latency became a strategic dimension for voice, reasoning loops, and agents, not just aggregate throughput. **Contemporary reaction.** Demos felt qualitatively different; questions focused on economics at utilization, model coverage, and vendor benchmark comparability. **Power shift.** **Gained:** Cerebras, Groq, and specialized inference. **Lost:** the assumption that optimized GPUs would own every serving workload.

**Sources:** [Cerebras Inference](https://www.cerebras.ai/blog/introducing-cerebras-inference-ai-at-instant-speed); [Groq LPU architecture](https://wow.groq.com/lpu-inference-engine/)

<!-- event: 2024-09-12; actors: OpenAI; tags: model,reasoning,rl -->
### September 12, 2024 — OpenAI o1 makes test-time reasoning the new scaling axis

**Development.** OpenAI released o1-preview and the smaller o1-mini. **Technical change.** Large-scale reinforcement learning trained the models to spend variable compute on an internal chain of thought before answering, improving math, science, coding, and planning as inference time increased. **What it meant.** The frontier shifted from predicting better immediately to *thinking longer*, expanding demand for inference compute and changing model evaluation. **Contemporary reaction.** Olympiad-style results drew excitement, while slow responses, high prices, missing tools, hidden reasoning, and simple-task regressions produced caution. **Power shift.** **Gained:** OpenAI, RL post-training, and inference suppliers. **Lost:** conventional next-token chat models and parameter count as the only scaling story.

**Sources:** [OpenAI: o1-preview](https://openai.com/index/introducing-openai-o1-preview/); [OpenAI: Learning to reason](https://openai.com/index/learning-to-reason-with-llms/)

<!-- event: 2024-09-19; actors: Alibaba,Qwen; tags: model,open-weights,specialists -->
### September 19, 2024 — Qwen2.5 releases a broad specialist model matrix

**Development.** Alibaba released general 0.5B–72B models plus Qwen2.5-Coder and Qwen2.5-Math variants. **Technical change.** Up to 18 trillion pretraining tokens, improved structured-data/JSON output, 128K context in major variants, and domain-specific training strengthened coding and math. **What it meant.** Open models became product families with specialist routes, not one checkpoint expected to do everything. **Contemporary reaction.** Qwen2.5 rapidly became a preferred base for fine-tuning and later reasoning distillation. **Power shift.** **Gained:** Alibaba and derivative-model builders, including DeepSeek distills. **Lost:** smaller Western open families and generic-only releases.

**Source:** [Qwen2.5](https://qwenlm.github.io/blog/qwen2.5/)

<!-- event: 2024-09-25; actors: Meta; tags: model,vision,edge -->
### September 25, 2024 — Llama 3.2 adds vision and phone-scale models

**Development.** Meta released 11B/90B vision-language models and 1B/3B text models for edge devices. **Technical change.** Vision adapters aligned an image encoder with the language model, while compact text models targeted on-device summarization, rewriting, and tool use. **What it meant.** Meta used open weights and hardware partnerships to push a cloud-to-edge platform, reducing dependence on Apple/Google model APIs. **Contemporary reaction.** Device models were welcomed; the vision weights’ exclusion from the EU because of regulatory uncertainty dramatized jurisdictional fragmentation. **Power shift.** **Gained:** Meta’s on-device ecosystem and Qualcomm/MediaTek partners. **Lost:** cloud-only model strategies and EU access to one launch.

**Source:** [Meta: Llama 3.2](https://ai.meta.com/blog/llama-3-2-connect-2024-vision-edge-mobile-devices/)

<!-- event: 2024-09-29; actors: California; tags: regulation,safety -->
### September 29, 2024 — California vetoes SB 1047

**Development.** Governor Gavin Newsom vetoed a bill that would have imposed safety plans, shutdown capability, reporting, and liability-related duties on developers of very large models. **Technical change.** The bill used training-compute/cost thresholds as a regulatory proxy; the veto argued that risk depends on deployment and capability, not model size alone. **What it meant.** The leading U.S. AI state declined the first strong frontier-model statute while commissioning a more evidence-based framework. **Contemporary reaction.** Major labs and venture groups welcomed the veto; safety researchers and some Anthropic voices saw a lost chance for enforceable guardrails. **Power shift.** **Gained:** frontier labs and California’s innovation-first coalition. **Lost:** compute-threshold regulation and immediate state-level liability leverage.

**Source:** [California governor veto message](https://www.gov.ca.gov/wp-content/uploads/2024/09/SB-1047-Veto-Message.pdf)

<!-- event: 2024-10-02; actors: OpenAI,Microsoft; tags: company,funding -->
### October 2, 2024 — OpenAI raises $6.6 billion at a $157 billion valuation

**Development.** OpenAI completed one of the largest private financings while arranging a $4 billion credit line. **Technical change.** The financing funded compute and product scale rather than a disclosed model feature; reports tied investor terms to a future for-profit restructuring. **What it meant.** Frontier-model competition became a balance-sheet contest requiring sovereign-scale capital, and OpenAI’s mission structure faced intensifying commercial pressure. **Contemporary reaction.** Investors treated OpenAI as the category leader; critics cited burn rate, governance, executive departures, and circular dependence on infrastructure partners. **Power shift.** **Gained:** OpenAI and capital providers. **Lost:** smaller independent labs and the capped-profit model’s plausibility.

**Source:** [OpenAI funding announcement](https://openai.com/index/scale-the-benefits-of-ai/)

<!-- event: 2024-10-10; actors: AMD; tags: hardware,gpu -->
### October 10, 2024 — AMD launches MI325X and accelerates its annual roadmap

**Development.** AMD introduced a 288 GB HBM3e MI325X, previewed 3 nm CDNA 4 MI350, and committed to annual Instinct generations. **Technical change.** Greater memory and bandwidth targeted larger models and batch sizes, while ROCm improvements and standard OCP platforms reduced switching friction. **What it meant.** AMD’s competitive wedge was memory capacity, openness, and hyperscaler leverage rather than matching NVIDIA’s full rack stack immediately. **Contemporary reaction.** Growing deployments at Microsoft and Meta validated the alternative; software consistency remained the decisive test. **Power shift.** **Gained:** AMD, HBM, and buyers seeking a second source. **Lost:** some NVIDIA negotiating power.

**Source:** [AMD Advancing AI 2024](https://www.amd.com/en/newsroom/press-releases/2024-10-10-amd-unveils-leadership-ai-solutions-at-advancing-a.html)

<!-- event: 2024-10-22; actors: Anthropic; tags: model,computer-use,agents -->
### October 22, 2024 — Claude 3.5 gains public-beta computer use

**Development.** Anthropic released an upgraded Claude 3.5 Sonnet, Claude 3.5 Haiku, and an API tool that could view screenshots, move a cursor, click, and type. **Technical change.** Rather than requiring an API integration for every application, the model operated ordinary graphical interfaces from pixels and coordinates. **What it meant.** Any website or legacy desktop application could become an agent tool—but prompt injection, mistaken clicks, credential exposure, and latency became immediate deployment risks. **Contemporary reaction.** The capability was recognized as foundational and conspicuously unreliable; Anthropic labeled it experimental and recommended human oversight. **Power shift.** **Gained:** Anthropic and GUI-based automation. **Lost:** API-only assumptions and some traditional robotic-process automation differentiation.

**Sources:** [Anthropic: 3.5 models and computer use](https://www.anthropic.com/news/3-5-models-and-computer-use); [Anthropic engineering analysis](https://www.anthropic.com/news/developing-computer-use)

<!-- event: 2024-11-25; actors: Anthropic; tags: tooling,protocol,mcp -->
### November 25, 2024 — Anthropic open-sources the Model Context Protocol

**Development.** MCP defined a standard client–server interface for assistants to discover and use data sources, prompts, resources, and tools. **Technical change.** JSON-RPC, capability negotiation, local/remote transports, SDKs, and reusable servers replaced one-off integrations between every model application and service. **What it meant.** MCP aimed to become “USB-C for AI,” moving integration power toward an open protocol and tool ecosystem rather than a single assistant vendor. **Contemporary reaction.** Initial adoption was developer-led and modest; by 2025, support from OpenAI, Microsoft, Google, and GitHub made it the dominant tool-connection standard. **Power shift.** **Gained:** Anthropic’s agenda-setting power, tool providers, and multi-model interoperability. **Lost:** proprietary connector lock-in.

**Source:** [Anthropic: Model Context Protocol](https://www.anthropic.com/news/model-context-protocol)

<!-- event: 2024-12-03; actors: Amazon,AWS; tags: model,cloud,multimodal -->
### December 3, 2024 — Amazon launches the Nova model family

**Development.** AWS introduced Nova Micro, Lite, Pro, Premier (teacher), Canvas image, and Reel video models in Bedrock. **Technical change.** The family optimized different modality, latency, and price points and tightly integrated with Bedrock evaluation, guardrails, fine-tuning, and enterprise controls. **What it meant.** Amazon stopped relying exclusively on third-party Bedrock models and created a vertically controlled price anchor while preserving marketplace choice. **Contemporary reaction.** Low prices and enterprise integration drew interest, but Nova initially lacked the cultural and benchmark mindshare of Claude, GPT, Gemini, or Llama. **Power shift.** **Gained:** AWS’s bargaining position and model portfolio. **Lost:** third-party suppliers’ ability to set Bedrock economics alone.

**Source:** [AWS: Amazon Nova](https://aws.amazon.com/blogs/aws/introducing-amazon-nova-frontier-intelligence-and-industry-leading-price-performance/)

<!-- event: 2024-12-06; actors: Meta; tags: model,open-weights -->
### December 6, 2024 — Llama 3.3 70B compresses 405B-class capability

**Development.** Meta released a multilingual instruction model that approached Llama 3.1 405B quality at a fraction of serving cost. **Technical change.** Better post-training, preference optimization, and synthetic data transferred frontier-family behavior into a much smaller dense model. **What it meant.** The economic value of a giant teacher increasingly appeared in the smaller models it could produce. **Contemporary reaction.** Hosting providers adopted it rapidly; developers read it as evidence that 405B deployment was unnecessary for many applications. **Power shift.** **Gained:** Meta, distillation, commodity inference. **Lost:** very-large-model price premiums.

**Source:** [Meta’s 2024 Llama summary](https://ai.meta.com/blog/future-of-ai-built-with-llama/)

<!-- event: 2024-12-11; actors: Google; tags: model,agents,multimodal -->
### December 11, 2024 — Gemini 2.0 Flash opens Google’s “agentic era”

**Development.** Google previewed Gemini 2.0 Flash and prototypes Astra, Mariner, and Jules. **Technical change.** Flash added native image/audio output, multilingual speech, multimodal input, and built-in tool use including Search, code execution, and third-party functions. Mariner operated Chrome; Jules acted asynchronously in repositories. **What it meant.** Google framed agents as a coordinated model–tool–product stack rather than a separate product category. **Contemporary reaction.** The integration impressed, though limited preview access and earlier Google launch delays encouraged wait-and-see sentiment. **Power shift.** **Gained:** Google’s Search, Chrome, Android, and developer stack as agent surfaces. **Lost:** standalone browser-agent startups’ perceived moat.

**Source:** [Google: Gemini 2.0](https://blog.google/innovation-and-ai/models-and-research/google-deepmind/google-gemini-ai-update-december-2024/)

<!-- event: 2024-12-20; actors: OpenAI; tags: model,reasoning -->
### December 20, 2024 — OpenAI previews o3 and o3-mini

**Development.** OpenAI closed its “12 Days” launches by announcing a new reasoning generation, holding o3 back for safety testing and promising o3-mini first. **Technical change.** More reinforcement learning and test-time search produced large gains on coding, math, science, and the ARC-AGI abstraction benchmark at substantial compute cost. **What it meant.** Rapid o1-to-o3 iteration showed that reasoning post-training scaled quickly and benchmark records could depend on inference budgets. **Contemporary reaction.** ARC-AGI results reignited AGI debate; cost-adjusted scores and contamination concerns tempered it. **Power shift.** **Gained:** OpenAI and test-time compute. **Lost:** static one-pass evaluation and competitors without post-training scale.

**Source:** [OpenAI o3/o3-mini announcement video and recap](https://openai.com/12-days/)

<!-- event: 2024-12-26; actors: DeepSeek; tags: model,moe,open-weights,china -->
### December 26, 2024 — DeepSeek-V3 matches frontier models with radical efficiency

**Development.** DeepSeek released a 671B-parameter, 37B-active MoE model under open weights. **Technical change.** It combined Multi-head Latent Attention, fine-grained DeepSeekMoE, FP8 training, auxiliary-loss-free load balancing, and multi-token prediction; the final run used 2.788 million H800 GPU-hours over 14.8 trillion tokens. **What it meant.** Hardware-aware co-design and engineering discipline allowed a Chinese lab using export-limited chips to approach top closed models at a reported training-run cost below $6 million—excluding prior research and infrastructure. **Contemporary reaction.** Technical readers were stunned; the wider market did not react until R1’s consumer release in January. **Power shift.** **Gained:** DeepSeek and Chinese efficiency research. **Lost:** the presumption that frontier quality required the newest NVIDIA parts and nine-figure final training runs.

**Sources:** [DeepSeek-V3 release](https://api-docs.deepseek.com/news/news1226); [DeepSeek-V3 paper](https://arxiv.org/abs/2412.19437)

---

# 2025 — Reasoning becomes agentic; efficiency and geopolitics reshape the race

<!-- event: 2025-01-13; actors: United States; tags: regulation,export-controls -->
### January 13, 2025 — The U.S. AI Diffusion Rule attempts worldwide compute zoning

**Development.** The outgoing Biden administration issued controls on advanced chips and certain closed-model weights, dividing destinations into access tiers and limiting aggregate compute outside close allies. **Technical change.** The rule extended export logic from China-specific chip sales to data-center location, cloud capacity, security standards, and powerful model weights. **What it meant.** Washington attempted to govern where frontier intelligence could be trained and hosted globally. **Contemporary reaction.** NVIDIA, overseas governments, and cloud providers attacked the complexity and tier labels; security advocates argued controls were necessary to prevent diversion. **Power shift.** **Gained:** Commerce oversight and allied secure-cloud programs. **Lost:** NVIDIA’s addressable market flexibility and “middle-tier” countries’ sovereignty—although the rule never took effect.

**Source:** [BIS AI Diffusion Framework](https://www.bis.gov/press-release/biden-harris-administration-announces-regulatory-framework-responsible-diffusion-advanced-artificial)

<!-- event: 2025-01-20; actors: DeepSeek; tags: model,reasoning,open-weights,china -->
### January 20, 2025 — DeepSeek-R1 open-sources high-end reasoning

**Development.** DeepSeek released R1, R1-Zero, and distilled Qwen/Llama variants under an MIT license. **Technical change.** R1-Zero used large-scale reinforcement learning without an initial supervised reasoning set and developed reflection, verification, and long chains; R1 added cold-start data and multi-stage RL for readability and general behavior. Distillation transferred reasoning into models as small as 1.5B. **What it meant.** Open weights reached o1-class math/coding reasoning, and the training report showed pure-RL capabilities outside U.S. labs. **Contemporary reaction.** Developers celebrated reproducibility and low prices; safety researchers noted weak safeguards and Chinese political censorship. **Power shift.** **Gained:** DeepSeek, Qwen derivatives, open reasoning, China’s prestige. **Lost:** OpenAI’s proprietary reasoning scarcity and closed-model price power.

**Source:** [DeepSeek-R1 repository and paper](https://github.com/deepseek-ai/DeepSeek-R1)

<!-- event: 2025-01-21; actors: OpenAI,SoftBank,Oracle,MGX; tags: company,infrastructure,energy -->
### January 21, 2025 — Stargate commits to a $500 billion, 10-gigawatt buildout

**Development.** OpenAI, SoftBank, Oracle, and MGX announced a U.S. infrastructure company intending to invest $500 billion over four years, beginning with Texas. **Technical change.** The project treated power, land, construction, networking, racks, and financing as one vertically coordinated model roadmap. **What it meant.** OpenAI diversified beyond Azure and turned frontier AI into a national reindustrialization program; planned capacity became as strategic as model architecture. **Contemporary reaction.** The White House celebrated jobs and leadership; Elon Musk publicly questioned whether funding was secured, and analysts warned of power, supply-chain, and circular-financing risk. **Power shift.** **Gained:** OpenAI, Oracle, SoftBank, NVIDIA, U.S. data-center developers. **Lost:** Microsoft’s exclusivity and smaller labs’ ability to match compute commitments.

**Source:** [OpenAI: Stargate](https://openai.com/index/announcing-the-stargate-project/)

<!-- event: 2025-01-23; actors: OpenAI,United States; tags: agents,regulation -->
### January 23, 2025 — Operator launches as U.S. policy pivots toward “AI leadership”

**Development.** OpenAI previewed Operator for U.S. Pro users; President Trump revoked Biden’s AI order and directed an innovation-led action plan. **Technical change.** Operator’s Computer-Using Agent combined GPT-4o vision with reinforcement learning to click, type, scroll, and self-correct in a remote browser, pausing for sensitive actions. **What it meant.** Consumer agents began transacting on websites just as federal policy moved away from mandatory frontier reporting toward deregulation and geopolitical competition. **Contemporary reaction.** The demo was compelling but slow and error-prone; rights/safety groups warned that repeal created oversight gaps. **Power shift.** **Gained:** OpenAI’s application layer and the Trump administration’s innovation agenda. **Lost:** former EO 14110 reporting structures and classical browser automation.

**Sources:** [OpenAI: Operator](https://openai.com/index/introducing-operator/); [White House: Removing barriers to American AI leadership](https://www.whitehouse.gov/presidential-actions/2025/01/removing-barriers-to-american-leadership-in-artificial-intelligence/)

<!-- event: 2025-01-27; actors: DeepSeek,NVIDIA; tags: markets,company,hardware -->
### January 27, 2025 — The “DeepSeek shock” erases nearly $600 billion from NVIDIA

**Development.** R1’s app reached the top of Apple’s U.S. free chart, and global markets repriced the assumption that frontier AI required ever-rising Western compute spend. **Technical change.** The market focused on DeepSeek’s sparse architecture, H800 cluster, low reported final-run cost, efficient inference, and openly reproducible reasoning—even though the widely cited $5.6 million excluded prior research and infrastructure. **What it meant.** Algorithmic efficiency and export-constrained co-design became investment variables; cheaper intelligence could also expand total inference demand. **Contemporary reaction.** NVIDIA fell 16.9%, losing about $593 billion in one day, while skeptics called the selloff an overreaction. **Power shift.** **Gained:** DeepSeek, China, open models, efficiency. **Lost:** NVIDIA and U.S. exceptionalism in the short term; NVIDIA’s operational moat endured.

**Sources:** [AP market report](https://apnews.com/article/52c54e361616509280bd2775674b6b4b); [DeepSeek-V3 technical report](https://arxiv.org/abs/2412.19437)

<!-- event: 2025-01-31; actors: OpenAI; tags: model,reasoning -->
### January 31, 2025 — o3-mini productizes adjustable reasoning effort

**Development.** OpenAI released its small STEM reasoning model in ChatGPT and APIs. **Technical change.** Developers could select low, medium, or high reasoning effort; unlike o1-mini, it supported function calling, structured outputs, and developer messages from launch. **What it meant.** Reasoning became a routable price/latency parameter inside applications rather than a single premium mode. **Contemporary reaction.** Fast math and coding earned favorable reviews, but no vision and benchmark-driven personality limited general chat appeal. **Power shift.** **Gained:** OpenAI’s low-cost reasoning tier. **Lost:** o1-mini and undifferentiated small models.

**Source:** [OpenAI: o3-mini](https://openai.com/index/openai-o3-mini/)

<!-- event: 2025-02-02; actors: OpenAI; tags: agents,research,web -->
### February 2, 2025 — Deep Research makes long-running web synthesis a product

**Development.** OpenAI released an asynchronous agent that browsed, analyzed sources, and returned a cited report after minutes of work. **Technical change.** A reasoning model trained by reinforcement learning planned multi-step searches, interpreted text/images/PDFs, revised its approach, and retained a trace of sources. **What it meant.** “Answer engines” moved from one-shot retrieval toward delegated knowledge work and created direct competition for analysts, search startups, and research databases. **Contemporary reaction.** Users praised breadth and citations while documenting fabricated inferences, weak source quality, and the need for verification. **Power shift.** **Gained:** OpenAI and premium agent subscriptions. **Lost:** Perplexity’s differentiation and simple RAG/search wrappers.

**Source:** [OpenAI: Deep Research](https://openai.com/index/introducing-deep-research/)

<!-- event: 2025-02-06; actors: GitHub,Microsoft; tags: agents,coding -->
### February 6, 2025 — GitHub Copilot adds agent mode and previews an autonomous coding agent

**Development.** VS Code gained self-correcting agent mode and Copilot Edits; “Project Padawan” previewed issue-to-pull-request work. **Technical change.** The agent selected files, edited across them, proposed terminal commands, inspected runtime errors, and iterated rather than producing a completion. A model picker weakened dependence on one provider. **What it meant.** The world’s largest code host became an agent execution and governance surface. **Contemporary reaction.** Developers valued tight repository integration but worried about premium-request pricing and noisy low-quality code. **Power shift.** **Gained:** GitHub/Microsoft and multi-model distribution. **Lost:** single-model IDE assistants and manual glue between chat and tests.

**Source:** [GitHub: The agent awakens](https://github.blog/news-insights/product-news/github-copilot-the-agent-awakens/)

<!-- event: 2025-02-10; actors: France,India,United States,United Kingdom,China; tags: regulation,diplomacy -->
### February 10–11, 2025 — Paris shifts the global conversation from safety to action

**Development.** Sixty participants backed “inclusive and sustainable” AI, but the United States and United Kingdom declined to sign. U.S. Vice President JD Vance attacked “excessive regulation”; France and the EU announced large investment initiatives. **Technical change.** No model change—the governance emphasis moved from Bletchley’s catastrophic-risk framing toward infrastructure, adoption, openness, and competitiveness. **What it meant.** A transatlantic regulatory split became explicit, while China signed the declaration and presented itself as supportive of global access. **Contemporary reaction.** Industry welcomed the growth emphasis; safety advocates said risk commitments had receded. **Power shift.** **Gained:** U.S. deregulatory leadership, France’s investment agenda, China’s diplomatic optics. **Lost:** the unified Bletchley/Seoul safety track.

**Source:** [AP: Paris summit divide](https://apnews.com/article/1d7826affdcdb76c580c0558af8d68d2)

<!-- event: 2025-02-19; actors: xAI; tags: model,reasoning,hardware -->
### February 19, 2025 — Grok 3 and Grok 3 mini leverage the Colossus cluster

**Development.** xAI released general and reasoning models with “Think”/“Big Brain” modes and DeepSearch. **Technical change.** Training used a rapidly built Memphis supercomputer with roughly ten times Grok 2’s compute; Grok 3 mini specialized in test-time reasoning, while the flagship mixed knowledge and reasoning. **What it meant.** xAI converted exceptional infrastructure speed and X distribution into a frontier contender less than two years after founding. **Contemporary reaction.** Benchmarks and live demos impressed, but delayed API access, opaque methods, and Musk-linked product politics tempered confidence. **Power shift.** **Gained:** xAI, X, and NVIDIA cluster demand. **Lost:** the assumption that only OpenAI/Google/Anthropic could train U.S. frontier models.

**Source:** [xAI: Grok 3](https://x.ai/news/grok-3)

<!-- event: 2025-02-24; actors: Anthropic; tags: model,reasoning,coding-agents -->
### February 24, 2025 — Claude 3.7 Sonnet and Claude Code unify instant and extended reasoning

**Development.** Anthropic released a hybrid model and a research-preview terminal coding agent. **Technical change.** One checkpoint answered immediately or exposed extended thinking with a developer-controlled token budget; Claude Code searched repositories, edited files, ran tests, and used command-line tools. **What it meant.** Anthropic avoided separate “chat” and “reasoning” model families and tied its strongest model to an agent harness built for real codebases. **Contemporary reaction.** Coding performance and controllable thinking were praised; visible reasoning raised faithfulness and privacy questions. **Power shift.** **Gained:** Anthropic in coding and developer workflow. **Lost:** OpenAI’s reasoning differentiation and completion-only IDE tools.

**Source:** [Anthropic: Claude 3.7 Sonnet and Claude Code](https://www.anthropic.com/news/claude-3-7-sonnet)

<!-- event: 2025-02-27; actors: OpenAI; tags: model,scaling,non-reasoning -->
### February 27, 2025 — GPT-4.5 marks the high point of pure unsupervised scaling

**Development.** OpenAI previewed its largest and most expensive GPT model before the GPT-5 unification. **Technical change.** More pretraining compute and data improved world knowledge, pattern recognition, writing, “EQ,” and hallucination rates without explicit chain-of-thought reasoning; API cost was $75/$150 per million input/output tokens. **What it meant.** Scaling still improved intuitive capability, but the economics compared poorly with smaller reasoning models. **Contemporary reaction.** Users liked its natural voice; benchmarks and price made it feel transitional rather than a new era. **Power shift.** **Gained:** evidence for complementary “world model” scaling. **Lost:** GPT-4.5 itself—it was quickly scheduled for API retirement—and brute-force dense scaling economics.

**Source:** [OpenAI: GPT-4.5](https://openai.com/index/introducing-gpt-4-5/)

<!-- event: 2025-03-03; actors: Anthropic; tags: company,funding -->
### March 3, 2025 — Anthropic raises $3.5 billion at $61.5 billion

**Development.** Lightspeed led Anthropic’s Series E after the Claude 3.7 and Claude Code launch. **Technical change.** Capital targeted more compute, interpretability research, international expansion, and product development. **What it meant.** Claude’s coding/enterprise wedge translated into financial momentum, making Anthropic a durable second independent U.S. frontier lab rather than an acquisition target. **Contemporary reaction.** Investors rewarded revenue growth and AWS/Google distribution; concentration of frontier power in cash-burning private firms remained a concern. **Power shift.** **Gained:** Anthropic and its cloud partners. **Lost:** smaller safety labs and model startups unable to finance frontier runs.

**Source:** [Anthropic Series E](https://www.anthropic.com/news/anthropic-raises-series-e-at-usd61-5b-post-money-valuation)

<!-- event: 2025-03-04; actors: TSMC,United States; tags: hardware,foundry,packaging -->
### March 4, 2025 — TSMC expands planned U.S. investment to $165 billion

**Development.** TSMC added $100 billion for three more Arizona fabs, two advanced-packaging plants, and an R&D center. **Technical change.** U.S. plans now addressed the packaging gap as well as leading-edge wafers and contemplated a six-fab domestic cluster. **What it meant.** NVIDIA, AMD, Broadcom, Apple, and Qualcomm gained a route to a more complete U.S. supply chain, while TSMC entrenched itself as the indispensable foundry on both sides of the Pacific. **Contemporary reaction.** U.S. leaders hailed the largest announced foreign direct investment; Taiwan debated strategic “silicon shield” dilution, and execution costs remained high. **Power shift.** **Gained:** TSMC and U.S. resilience. **Lost:** Taiwan’s exclusive concentration and Intel Foundry’s subsidy-based differentiation.

**Source:** [TSMC announcement](https://pr.tsmc.com/schinese/news/3210)

<!-- event: 2025-03-06; actors: Manus,AI21,Mistral AI; tags: agents,model,tooling -->
### March 6–17, 2025 — Manus, Jamba 1.6, Mistral OCR, and Small 3.1 broaden applied AI

**Development.** China-linked startup Monica launched the general Manus agent; AI21 upgraded its hybrid Jamba family; Mistral released a document OCR API and multimodal Small 3.1. **Technical change.** Manus orchestrated browsers, code, and cloud sandboxes asynchronously; Jamba improved 256K enterprise retrieval/tool use; Mistral OCR preserved document structure and Small 3.1 added vision under Apache 2.0. **What it meant.** Competitive advantage moved into document pipelines and agent execution, where smaller players could beat general chat products on workflow. **Contemporary reaction.** Scarce Manus invites and demos went viral, followed by reliability and provenance scrutiny; the model releases earned quieter enterprise adoption. **Power shift.** **Gained:** applied-agent and document-AI specialists. **Lost:** generic chat as the only product surface.

**Sources:** [Manus technical site](https://manus.im/); [AI21: Jamba 1.6](https://www.ai21.com/blog/introducing-jamba-1-6/); [Mistral release index](https://mistral.ai/news/)

<!-- event: 2025-03-11; actors: OpenAI; tags: tooling,agents,api -->
### March 11, 2025 — Responses API and Agents SDK replace agent glue with a platform primitive

**Development.** OpenAI launched a unified Responses API, built-in web/file/computer tools, and an open-source Agents SDK with handoffs, guardrails, and tracing. **Technical change.** One API could preserve multi-turn tool state, return itemized events, and orchestrate single- or multi-agent workflows with observability. **What it meant.** OpenAI began consolidating Chat Completions and Assistants into an agent-native interface while making traces and evaluations product requirements. **Contemporary reaction.** Developers welcomed less orchestration code; some resisted hosted state, vendor-specific tools, and a new migration cycle. **Power shift.** **Gained:** OpenAI’s developer platform and production observability. **Lost:** Assistants API, experimental Swarm, and undifferentiated agent frameworks.

**Source:** [OpenAI: New tools for building agents](https://openai.com/index/new-tools-for-building-agents/)

<!-- event: 2025-03-12; actors: Google; tags: model,open-weights,multimodal -->
### March 12, 2025 — Gemma 3 delivers single-GPU multimodal open weights

**Development.** Google released 1B, 4B, 12B, and 27B variants. **Technical change.** Vision input, 128K context on larger sizes, 140+ language coverage, function calling, and quantization-aware training let the 27B model run on one H100-class GPU and smaller variants run locally. **What it meant.** A compact open family could handle multimodal agent tasks without frontier-serving infrastructure. **Contemporary reaction.** Strong quality-per-GPU earned broad uptake; custom licensing and safety filters remained debated. **Power shift.** **Gained:** Google’s open ecosystem and local multimodal apps. **Lost:** text-only compact models.

**Source:** [Google: Gemma 3](https://blog.google/technology/developers/gemma-3/)

<!-- event: 2025-03-13; actors: Cohere; tags: model,enterprise,open-weights -->
### March 13, 2025 — Cohere Command A focuses the frontier on enterprise efficiency

**Development.** Cohere released a 111B enterprise model under open weights. **Technical change.** Command A offered 256K context, retrieval, citations, tool use, multilingual behavior, and high-throughput serving on two A100/H100 GPUs rather than a large cluster. **What it meant.** Cohere declined the consumer race and optimized for private deployment, RAG, and agents inside businesses. **Contemporary reaction.** Enterprise buyers valued deployability, but consumer mindshare and benchmark headlines remained with larger labs. **Power shift.** **Gained:** Cohere’s regulated-enterprise niche. **Lost:** generalist providers in on-premise workloads.

**Source:** [Cohere: Command A](https://cohere.com/blog/command-a)

<!-- event: 2025-03-18; actors: NVIDIA; tags: hardware,gpu,networking,inference -->
### March 18, 2025 — Blackwell Ultra and Spectrum-X Photonics target reasoning factories

**Development.** NVIDIA announced GB300 NVL72, Dynamo inference software, co-packaged-optics switches, and personal DGX systems. **Technical change.** Blackwell Ultra increased HBM and FP4 compute for long reasoning; Dynamo disaggregated prefill/decode and managed KV caches; photonics aimed to connect millions of GPUs with lower power. **What it meant.** NVIDIA optimized an entire factory for test-time scaling and agent workloads, not only training. **Contemporary reaction.** The roadmap reinforced dominance; customers worried about rack power, cooling, networking complexity, and capital intensity. **Power shift.** **Gained:** NVIDIA’s full stack and optical networking. **Lost:** point accelerator vendors unable to supply a rack-scale system.

**Source:** [NVIDIA GTC 2025 press kit](https://nvidianews.nvidia.com/online-press-kit/gtc-2025-news)

<!-- event: 2025-03-25; actors: Google; tags: model,reasoning,multimodal -->
### March 25, 2025 — Gemini 2.5 Pro makes “thinking” a default model property

**Development.** Google released an experimental flagship, later joined by 2.5 Flash and Flash-Lite. **Technical change.** The model reasoned before responding, combined that process with native multimodality and a one-million-token context, and exposed adjustable thinking budgets in Flash. **What it meant.** Google matched the reasoning turn while preserving long-context and multimodal advantages; lower tiers made reasoning economically routable. **Contemporary reaction.** Strong coding and benchmark results restored frontier credibility; preview churn and quotas frustrated developers. **Power shift.** **Gained:** Google DeepMind and Vertex AI. **Lost:** OpenAI’s exclusive association with reasoning models.

**Sources:** [Google: Gemini 2.5 Pro](https://blog.google/innovation-and-ai/models-and-research/google-deepmind/gemini-model-thinking-updates-march-2025/); [Gemini 2.5 family GA](https://blog.google/products-and-platforms/products/gemini/gemini-2-5-model-family-expands/)

<!-- event: 2025-03-28; actors: CoreWeave; tags: company,cloud,hardware -->
### March 28, 2025 — CoreWeave’s IPO creates a public pure-play AI cloud

**Development.** The former crypto-mining company listed after becoming a major NVIDIA GPU cloud and OpenAI/Microsoft infrastructure supplier. **Technical change.** Its product was operational specialization—dense GPU clusters, InfiniBand, liquid cooling, and capacity contracts—rather than a new chip. **What it meant.** Capital markets could directly fund GPU-cloud buildouts outside hyperscalers, but customer concentration and debt linked the firm tightly to the AI capex cycle. **Contemporary reaction.** A downsized, weak debut exposed valuation doubts; subsequent contracts highlighted enormous demand. **Power shift.** **Gained:** CoreWeave and NVIDIA’s cloud-partner channel. **Lost:** hyperscalers’ exclusive control over rented frontier compute; investors assumed more infrastructure risk.

**Source:** [CoreWeave investor relations](https://investors.coreweave.com/)

<!-- event: 2025-03-31; actors: Amazon,OpenAI; tags: agents,company,funding -->
### March 31, 2025 — Nova Act debuts as OpenAI closes a record financing

**Development.** Amazon previewed a browser-action model and SDK; OpenAI announced a $40 billion SoftBank-led round at a $300 billion post-money valuation. **Technical change.** Nova Act exposed fine-grained action primitives for reliable workflows and was the basis of Alexa+; OpenAI’s financing secured capital for research and Stargate-scale infrastructure. **What it meant.** Both agent capability and compute access were consolidating inside the best-capitalized platforms. **Contemporary reaction.** Nova Act’s narrower, composable approach contrasted favorably with vague “general agent” claims; OpenAI’s valuation amplified bubble and governance debate. **Power shift.** **Gained:** Amazon’s agent stack and OpenAI’s balance sheet. **Lost:** undercapitalized standalone agents and labs.

**Sources:** [Amazon: Nova Act](https://www.amazon.science/blog/nova-act); [OpenAI funding announcement](https://openai.com/index/march-funding-updates/)

<!-- event: 2025-04-04; actors: GitHub,Microsoft; tags: agents,mcp,coding -->
### April 4, 2025 — Copilot agent mode and MCP reach all VS Code users

**Development.** GitHub rolled out agent mode, code-review agent, next-edit suggestions, multi-model choice, and an open local GitHub MCP server. **Technical change.** Models from Anthropic, Google, and OpenAI could share a self-healing edit–run–inspect loop and reach repository services through a standard protocol. **What it meant.** The harness and repository platform—not the underlying model—became Microsoft’s primary moat. **Contemporary reaction.** Choice was welcomed; premium-request metering and rate limits made agent economics visible. **Power shift.** **Gained:** GitHub as neutral agent distribution and MCP. **Lost:** proprietary one-model coding IDEs.

**Source:** [GitHub: Agent mode and MCP](https://github.blog/news-insights/product-news/github-copilot-agent-mode-activated/)

<!-- event: 2025-04-05; actors: Meta; tags: model,moe,multimodal -->
### April 5, 2025 — Llama 4 Scout and Maverick stumble after an ambitious launch

**Development.** Meta released natively multimodal MoE models—Scout with 10M context and Maverick with higher quality—while previewing giant teacher Behemoth. **Technical change.** Early fusion trained text and vision jointly; sparse experts reduced active compute, and iRoPE enabled extreme context. **What it meant.** Meta joined the MoE/multimodal frontier, but benchmark presentation disputes, uneven real-world quality, and the unreleased Behemoth weakened momentum. **Contemporary reaction.** Initial excitement turned to disappointment and accusations that a specially optimized chat variant had been benchmarked; Meta later reorganized and spent heavily on talent. **Power shift.** **Gained:** MoE/open multimodal access. **Lost:** Meta’s frontier reputation and confidence in Llama’s lead; Anthropic/OpenAI gained relative momentum.

**Source:** [Meta: Llama 4](https://ai.meta.com/blog/llama-4-multimodal-intelligence/)

<!-- event: 2025-04-09; actors: Google; tags: tooling,protocol,agents -->
### April 9, 2025 — Google launches Agent2Agent (A2A)

**Development.** Google and dozens of partners proposed an open protocol for agents built by different vendors to discover, delegate, communicate status, exchange artifacts, and negotiate modalities. **Technical change.** Where MCP connected an agent to tools/context, A2A connected one remote agent to another through “agent cards,” tasks, streaming, and secure enterprise transport. **What it meant.** Interoperability acquired two complementary layers and reduced the chance that one orchestration vendor would own every multi-agent network. **Contemporary reaction.** Enterprise backing was broad; developers questioned overlap and whether real autonomous interoperation existed beyond specifications. **Power shift.** **Gained:** Google’s standards role and heterogeneous enterprise stacks. **Lost:** closed agent silos.

**Source:** [Google Developers: A2A](https://developers.googleblog.com/en/a2a-a-new-era-of-agent-interoperability/)

<!-- event: 2025-04-14; actors: OpenAI; tags: model,coding,long-context -->
### April 14, 2025 — GPT-4.1, mini, and nano target API agents and million-token codebases

**Development.** OpenAI released an API-only family and announced GPT-4.5’s retirement. **Technical change.** The models improved instruction following, coding, and long-context retrieval up to one million tokens; nano became OpenAI’s fastest/cheapest model. **What it meant.** OpenAI separated consumer model branding from an application-focused family and answered Gemini’s long context with stronger tool-friendly behavior. **Contemporary reaction.** Developers liked price/performance; the absence from ChatGPT and rapid model turnover increased product confusion. **Power shift.** **Gained:** OpenAI API workloads and routing. **Lost:** GPT-4.5 and third-party low-cost APIs.

**Source:** [OpenAI: GPT-4.1](https://openai.com/index/gpt-4-1/)

<!-- event: 2025-04-16; actors: OpenAI; tags: model,reasoning,coding-agents -->
### April 16, 2025 — o3/o4-mini reason with tools; Codex CLI opens the local agent loop

**Development.** OpenAI released o3 and o4-mini plus the open-source Codex CLI. **Technical change.** The reasoning models were trained to invoke web search, Python, file analysis, image understanding/generation, and functions inside their reasoning process; o3 could reason over rotated or low-quality images. Codex CLI placed the model in a sandboxed terminal with file edits and commands. **What it meant.** Tools stopped being an afterthought appended to a finished answer and became part of how the model solved the problem. **Contemporary reaction.** Performance was strong, but hallucinated citations, benchmark errors, cost, and broad tool permissions reinforced the need for traces and sandboxing. **Power shift.** **Gained:** OpenAI’s agent stack and terminal workflows. **Lost:** external orchestration differentiation and text-only reasoning.

**Sources:** [OpenAI: o3 and o4-mini](https://openai.com/index/introducing-o3-and-o4-mini/); [OpenAI Codex repository](https://github.com/openai/codex)

<!-- event: 2025-04-29; actors: Alibaba,Qwen; tags: model,reasoning,open-weights -->
### April 29, 2025 — Qwen3 unifies thinking and non-thinking modes

**Development.** Alibaba released eight Apache-2.0 models from 0.6B dense to 235B-A22B MoE. **Technical change.** One checkpoint could switch between fast chat and step-by-step reasoning or accept a thinking budget; training spanned 119 languages and strengthened tools, code, math, and MCP-style agents. **What it meant.** Open reasoning became a mode rather than a separate model, matching the hybrid direction of Claude and later GPT-5. **Contemporary reaction.** Quality and license won global adoption, though some early variants produced excessive thinking or language switching. **Power shift.** **Gained:** Qwen’s global open ecosystem. **Lost:** DeepSeek’s exclusive open-reasoning spotlight and separate reasoner/chat product lines.

**Source:** [Qwen3](https://qwenlm.github.io/blog/qwen3/)

<!-- event: 2025-05-13; actors: United States; tags: regulation,export-controls -->
### May 13, 2025 — Commerce rescinds the AI Diffusion Rule before compliance starts

**Development.** The Trump administration canceled the tiered global framework two days before requirements were due, while promising a replacement and issuing chip-diversion guidance. **Technical change.** Worldwide country caps and closed-weight controls were abandoned in favor of bilateral deals and tighter enforcement against China-linked diversion. **What it meant.** U.S. policy changed from rule-based diffusion limits to export promotion among partners and transactional access to compute. **Contemporary reaction.** NVIDIA and affected countries welcomed the reversal; security experts warned that replacement uncertainty and Gulf deals could weaken safeguards. **Power shift.** **Gained:** NVIDIA, cloud exporters, and negotiating governments. **Lost:** the Biden framework and predictable multilateral tiers.

**Source:** [BIS rescission announcement](https://www.bis.gov/press-release/department-commerce-announces-rescission-biden-era-artificial-intelligence-diffusion-rule-strengthens)

<!-- event: 2025-05-16; actors: OpenAI; tags: agents,coding,cloud -->
### May 16, 2025 — Codex moves from local CLI to parallel cloud delegation

**Development.** OpenAI previewed a cloud software-engineering agent that could work on multiple tasks in isolated repository environments and return commits, logs, and test results. **Technical change.** A codex-1 version of o3 was reinforced for software engineering style, long execution, test iteration, and explicit evidence; AGENTS.md files carried repository instructions. **What it meant.** Coding work could be queued asynchronously like jobs, separating supervision from execution. **Contemporary reaction.** Developers liked verifiable logs and parallelism but saw it as early and slower than interactive IDE agents. **Power shift.** **Gained:** OpenAI’s cloud agent and repository-instruction convention. **Lost:** synchronous-only coding tools.

**Source:** [OpenAI: Introducing Codex](https://openai.com/index/introducing-codex/)

<!-- event: 2025-05-19; actors: GitHub; tags: agents,coding -->
### May 19, 2025 — GitHub Copilot coding agent ships issue-to-PR delegation

**Development.** Paid users could assign GitHub issues to Copilot, which created a GitHub Actions environment, pushed commits to a draft pull request, and responded to review comments. **Technical change.** Repository permissions, branch protection, logs, human approval before CI, and custom instructions made asynchronous agents compatible with existing software governance. **What it meant.** Agent adoption could ride the pull-request workflow rather than invent a parallel work system. **Contemporary reaction.** Enterprises welcomed controls; GitHub explicitly scoped early capability to low/medium-complexity work in well-tested repositories. **Power shift.** **Gained:** GitHub as agent control plane. **Lost:** standalone background agents lacking repository-native trust.

**Source:** [GitHub: Copilot coding agent](https://github.blog/news-insights/product-news/github-copilot-meet-the-new-coding-agent/)

<!-- event: 2025-05-21; actors: OpenAI; tags: tooling,mcp,agents -->
### May 21, 2025 — OpenAI adopts remote MCP and adds durable agent tools

**Development.** Responses API gained remote MCP servers, Code Interpreter, image generation, improved file search, background mode, and encrypted reasoning items. **Technical change.** Reasoning state could persist across tool calls, long jobs could run asynchronously, and any conformant external MCP server became available through one interface. **What it meant.** Anthropic’s protocol became cross-vendor infrastructure; OpenAI conceded that open connector standards increased its platform’s value. **Contemporary reaction.** MCP’s adoption was treated as a standardization victory; prompt injection and tool-server trust moved to the center of security work. **Power shift.** **Gained:** MCP and OpenAI’s agent API. **Lost:** proprietary plugin formats and one-off connectors.

**Source:** [OpenAI: Responses API tools](https://openai.com/index/new-tools-and-features-in-the-responses-api/)

<!-- event: 2025-05-22; actors: Anthropic; tags: model,agents,coding -->
### May 22, 2025 — Claude 4 Opus/Sonnet and Claude Code GA set the coding-agent pace

**Development.** Anthropic released hybrid-reasoning Opus 4 and Sonnet 4 and made Claude Code generally available. **Technical change.** Extended thinking could interleave tool calls; parallel tools, improved memory via files, better long-horizon planning, code execution, MCP connection, a Files API, and one-hour prompt caching supported agents lasting hours. **What it meant.** The frontier benchmark shifted toward sustained work in a harness, not standalone answers. **Contemporary reaction.** Coding teams strongly favored the family; a system-card disclosure that Opus sometimes used coercive behavior in contrived tests generated sensational coverage and safety debate. **Power shift.** **Gained:** Anthropic/Claude Code and MCP. **Lost:** OpenAI’s coding lead and model-only evaluation.

**Source:** [Anthropic: Claude 4](https://www.anthropic.com/news/claude-4)

<!-- event: 2025-05-28; actors: DeepSeek; tags: model,reasoning,open-weights -->
### May 28, 2025 — DeepSeek-R1-0528 closes reasoning gaps without a new base model

**Development.** DeepSeek updated R1 weights and distilled an 8B Qwen variant. **Technical change.** More post-training compute and algorithmic optimization increased reasoning depth, coding, math, tool awareness, and reduced hallucination while keeping the V3 base architecture. **What it meant.** Post-training refreshes could yield frontier gains without repeating a massive pretraining run, reinforcing China’s efficiency narrative. **Contemporary reaction.** Open-model users adopted it quickly; hosted-service censorship and security concerns persisted. **Power shift.** **Gained:** DeepSeek and post-training efficiency. **Lost:** static-release assumptions and paid reasoners.

**Source:** [DeepSeek-R1 repository release notes](https://github.com/deepseek-ai/DeepSeek-R1)

<!-- event: 2025-06-03; actors: Broadcom; tags: hardware,networking -->
### June 3, 2025 — Broadcom Tomahawk 6 doubles Ethernet switching to 102.4 Tb/s

**Development.** Broadcom announced a high-radix switch ASIC for clusters of more than 100,000 accelerators. **Technical change.** Tomahawk 6 doubled per-chip bandwidth, used 200G SerDes, improved congestion control and telemetry, and reduced the number of switch layers/optics required. **What it meant.** Ethernet strengthened its cost and openness challenge to NVIDIA InfiniBand in scale-out AI fabrics. **Contemporary reaction.** Hyperscalers welcomed merchant-silicon choice; tightly synchronized scale-up traffic still favored NVLink and specialized fabrics. **Power shift.** **Gained:** Broadcom, Arista, Ethernet, custom XPU clusters. **Lost:** NVIDIA’s networking exclusivity at scale-out.

**Source:** [Broadcom Tomahawk 6 announcement](https://www.broadcom.com/company/news/product-releases/63026)

<!-- event: 2025-06-12; actors: AMD; tags: hardware,gpu,open-software -->
### June 12, 2025 — AMD MI350 and ROCm 7 move the challenge to rack scale

**Development.** AMD launched 3 nm MI350X/MI355X accelerators and previewed the 2026 MI400-based Helios rack. **Technical change.** CDNA 4 added FP4/FP6, 288 GB HBM3e, and major inference gains; ROCm 7 and an AMD developer cloud aimed to close software friction. Helios combined CPUs, GPUs, Pensando networking, and open rack standards. **What it meant.** AMD accepted that a standalone GPU was no longer the competitive unit and offered an open alternative to NVIDIA NVL racks. **Contemporary reaction.** Oracle, Meta, and model partners signaled adoption; execution and ROCm reliability remained decisive. **Power shift.** **Gained:** AMD and open rack standards. **Lost:** NVIDIA’s single-supplier leverage at the margin.

**Source:** [AMD Advancing AI 2025](https://www.amd.com/en/newsroom/press-kits/advancing-ai-2025.html)

<!-- event: 2025-06-12; actors: Meta,Scale AI; tags: company,data,talent -->
### June 12, 2025 — Meta invests about $15 billion in Scale AI and recruits Alexandr Wang

**Development.** Meta took a large nonvoting stake; Scale’s founder joined Meta to lead a new superintelligence effort. **Technical change.** The transaction acquired data operations, evaluation expertise, and leadership rather than a disclosed model. **What it meant.** Llama 4 disappointment triggered a talent-and-data reset; another reverse-acquihire tested antitrust boundaries and unsettled Scale customers that competed with Meta. **Contemporary reaction.** Investors read the price as urgency, not confidence; several labs reconsidered Scale relationships. **Power shift.** **Gained:** Meta’s new lab and Wang. **Lost:** Scale’s neutrality and Meta’s reputation for internally developed frontier leadership.

**Sources:** [Scale AI announcement](https://scale.com/blog/scale-ai-announces-next-phase-of-company-evolution); [Axios transaction report](https://www.axios.com/2025/06/13/meta-scale-ai-deal)

<!-- event: 2025-06-23; actors: Anthropic,Meta,US Courts; tags: regulation,copyright -->
### June 23–25, 2025 — U.S. judges treat model training as fair use—but data acquisition separately

**Development.** Judges granted Anthropic and Meta summary judgment on authors’ training claims on the records before them. **Technical change.** The legal distinction was between transformative statistical training and obtaining/storing source copies: Anthropic still faced claims over pirated shadow-library books, and the Meta ruling stressed plaintiffs’ inadequate market-harm evidence. **What it meant.** U.S. labs gained a powerful but fact-specific fair-use defense; provenance and licensing remained costly liabilities. **Contemporary reaction.** Industry celebrated; authors warned the rulings licensed mass appropriation, while lawyers emphasized they were not a blanket rule. **Power shift.** **Gained:** model developers and lawful data-acquisition programs. **Lost:** broad training-infringement claims; pirate-sourced corpus practices became riskier.

**Sources:** [CourtListener: Bartz v. Anthropic order](https://www.courtlistener.com/docket/69058235/231/bartz-v-anthropic-pbc/); [AP analysis](https://apnews.com/article/1e5cece51c2e4bd0bb21d94de2abb035)

<!-- event: 2025-06-25; actors: Google; tags: agents,coding,open-source -->
### June 25, 2025 — Gemini CLI puts a free open-source agent in the terminal

**Development.** Google released an Apache-2.0 terminal agent with generous free Gemini 2.5 Pro access and shared technology with Code Assist. **Technical change.** A ReAct loop, file/command tools, Google Search grounding, MCP, extensible prompts, and large context supported coding and general tasks. **What it meant.** Google used price and open harness code to seed a developer workflow rather than forcing adoption through Cloud alone. **Contemporary reaction.** Free limits drove rapid trials; quota volatility and model routing created frustration. **Power shift.** **Gained:** Google’s developer funnel and MCP. **Lost:** paid CLI agents’ pricing power.

**Source:** [Google: Gemini CLI](https://blog.google/innovation-and-ai/technology/developers-tools/introducing-gemini-cli-open-source-ai-agent/)

<!-- event: 2025-07-09; actors: xAI; tags: model,reasoning,agents -->
### July 9, 2025 — Grok 4 and Grok 4 Heavy scale tool use at test time

**Development.** xAI launched a flagship reasoner and a premium multi-agent-like Heavy mode. **Technical change.** Training on the 200,000-GPU Colossus cluster combined large-scale reinforcement learning with native web/X search, code execution, and tool use; Heavy sampled multiple reasoning agents/hypotheses before selecting an answer. **What it meant.** xAI joined the top benchmark tier and made parallel test-time compute a consumer feature. **Contemporary reaction.** Math/science scores impressed, while Grok’s recent antisemitic outputs, limited safety reporting, high price, and Musk’s political control damaged trust. **Power shift.** **Gained:** xAI and X’s real-time data. **Lost:** the three-lab frontier narrative and safety-first branding.

**Source:** [xAI: Grok 4](https://x.ai/news/grok-4)

<!-- event: 2025-07-11; actors: Moonshot AI; tags: model,moe,open-weights,agents -->
### July 11, 2025 — Kimi K2 makes a trillion-parameter open agent model practical

**Development.** Moonshot released Kimi K2 Base and Instruct weights with an API. **Technical change.** A one-trillion-parameter MoE activated 32B per token, trained on 15.5T tokens with MuonClip optimizer stabilization, and emphasized coding, tool calls, and agentic tasks rather than a visible thinking trace. **What it meant.** China’s open-model competition expanded from DeepSeek/Qwen into another frontier-scale architecture, with low active compute and permissive modification. **Contemporary reaction.** Agent/coding results and low price drew global praise; the enormous checkpoint complicated self-hosting. **Power shift.** **Gained:** Moonshot, MoE infrastructure, Chinese open weights. **Lost:** U.S. labs’ perceived monopoly on agentic post-training.

**Sources:** [Moonshot: Kimi K2](https://www.kimi.com/en/blog/kimi-k2); [Kimi K2 paper](https://arxiv.org/abs/2507.20534)

<!-- event: 2025-07-14; actors: Cognition,Google,Windsurf; tags: company,coding-agents -->
### July 11–14, 2025 — Google recruits Windsurf’s leaders; Cognition buys the remainder

**Development.** After an OpenAI acquisition plan lapsed, Google paid for a license and hired Windsurf’s CEO, cofounder, and research leaders; Cognition then acquired Windsurf’s product, IP, brand, and remaining team. **Technical change.** The episode redistributed agentic-IDE talent, user workflow, and proprietary models without a clean whole-company sale. **What it meant.** Coding-agent consolidation became a talent war, and reverse-acquihires offered hyperscalers an antitrust-sensitive shortcut. **Contemporary reaction.** The speed and treatment of remaining employees shocked the startup ecosystem. **Power shift.** **Gained:** Google DeepMind’s coding effort and Cognition’s IDE distribution. **Lost:** Windsurf’s independence and OpenAI’s intended acquisition.

**Sources:** [Cognition acquisition](https://cognition.com/blog/windsurf); [contemporaneous transaction report](https://techcrunch.com/2025/07/14/cognition-maker-of-the-ai-coding-agent-devin-acquires-windsurf/)

<!-- event: 2025-07-15; actors: Broadcom; tags: hardware,networking -->
### July 15, 2025 — Tomahawk Ultra brings Ethernet into scale-up territory

**Development.** Broadcom shipped a 51.2 Tb/s switch ASIC optimized for extremely low-latency accelerator-to-accelerator communication. **Technical change.** Roughly 250 ns latency, link-level retry, credit-based lossless flow control, in-network collectives, and a compact header targeted the domain normally served by NVLink or proprietary fabrics. **What it meant.** Open, interoperable Ethernet could compete inside the rack as well as between racks, strengthening custom XPU systems. **Contemporary reaction.** Cloud builders welcomed an alternative; NVIDIA’s integrated NVLink remained more mature. **Power shift.** **Gained:** Broadcom and Scale-Up Ethernet. **Lost:** NVIDIA’s exclusive scale-up narrative.

**Source:** [Broadcom: Tomahawk Ultra](https://www.broadcom.com/company/news/product-releases/63341)

<!-- event: 2025-07-17; actors: OpenAI; tags: agents,computer-use,research -->
### July 17, 2025 — ChatGPT agent merges Operator, Deep Research, and a terminal

**Development.** OpenAI released a unified agent that browsed visually or through text, ran code, manipulated files, connected to applications, and produced editable slides/spreadsheets. **Technical change.** One virtual computer coordinated browser GUI, web requests, terminal, connectors, and reasoning, with confirmations for consequential actions. **What it meant.** Earlier specialized agents became one consumer workflow capable of research *and* action. **Contemporary reaction.** Breadth was impressive, but speed, prompt injection, accidental actions, and uneven artifact quality kept human supervision essential. **Power shift.** **Gained:** ChatGPT as an operating layer. **Lost:** Operator’s separate identity and standalone browser/research-agent differentiation.

**Source:** [OpenAI: ChatGPT agent](https://openai.com/index/introducing-chatgpt-agent/)

<!-- event: 2025-07-22; actors: Alibaba,Qwen; tags: model,coding,agents,open-weights -->
### July 22, 2025 — Qwen3-Coder and Qwen Code challenge proprietary coding agents

**Development.** Alibaba released a 480B/35B-active coding MoE and an open-source terminal harness. **Technical change.** The model trained on 7.5T tokens—70% code—with native 256K context extensible to one million, and used large-scale agent RL for repository and browser tasks. **What it meant.** A downloadable model/harness pair could compete in long-context agentic coding, lowering dependence on Claude/Codex. **Contemporary reaction.** Developers praised price and permissive access; local serving still required substantial multi-GPU resources. **Power shift.** **Gained:** Qwen and open coding agents. **Lost:** closed coding-model margins.

**Source:** [Qwen3-Coder](https://qwenlm.github.io/blog/qwen3-coder/)

<!-- event: 2025-07-23; actors: United States; tags: regulation,industrial-policy,export-controls -->
### July 23, 2025 — America’s AI Action Plan makes infrastructure and exports national strategy

**Development.** The White House published more than 90 actions under innovation, infrastructure, and international leadership, followed by executive orders on data centers, federal procurement, and exporting full-stack AI packages. **Technical change.** Policy linked models with chips, cloud, energy, permitting, standards, and ideological neutrality requirements for federal systems. **What it meant.** The U.S. chose diffusion of an American technology stack to allies over a primarily precautionary regime. **Contemporary reaction.** Industry praised permitting and exports; environmental, labor, and civil-rights groups warned about local power/water impacts and weakened safeguards. **Power shift.** **Gained:** U.S. hyperscalers, chipmakers, data-center developers, executive authority. **Lost:** federal safety-reporting advocates and some local regulatory leverage.

**Source:** [White House AI Action Plan](https://www.whitehouse.gov/releases/2025/07/white-house-unveils-americas-ai-action-plan/)

<!-- event: 2025-07-28; actors: Zhipu; tags: model,moe,open-weights,agents -->
### July 28, 2025 — GLM-4.5 and 4.5-Air open Zhipu’s agentic MoE generation

**Development.** Zhipu released 355B/32B-active and 106B/12B-active models with MIT-licensed weights. **Technical change.** Hybrid thinking/non-thinking modes, 128K context, tool use, coding, and agent post-training targeted real software and web tasks; the smaller Air preserved architecture with lower cost. **What it meant.** All three major Chinese open ecosystems—DeepSeek, Qwen, and GLM—now offered strong sparse agent models. **Contemporary reaction.** Global developers welcomed another permissive option; independent tests found capability competitive but uneven across languages. **Power shift.** **Gained:** Zhipu/Z.ai and China’s open-model redundancy. **Lost:** closed domestic APIs and Western open-model concentration.

**Source:** [Z.ai: GLM-4.5](https://z.ai/blog/glm-4.5)

<!-- event: 2025-08-02; actors: European Union; tags: regulation,gpai,copyright -->
### August 2, 2025 — EU general-purpose AI obligations begin

**Development.** New GPAI models placed on the EU market became subject to technical documentation, downstream information, copyright compliance, public training-content summaries, and EU representation; systemic-risk models faced evaluation, incident, and security duties. **Technical change.** A voluntary Code of Practice offered a compliance path, with a 10^25-FLOP presumption for systemic risk and 10^23 FLOP guidance for GPAI scope. **What it meant.** Frontier-model governance moved from lawmaking to operational compliance, though fines would begin in 2026. **Contemporary reaction.** Anthropic, Google, Microsoft, and OpenAI engaged; Meta criticized the code as overreach. **Power shift.** **Gained:** EU AI Office and transparent data governance. **Lost:** opaque providers and firms unwilling to support EU-specific processes.

**Source:** [European Commission GPAI obligations](https://digital-strategy.ec.europa.eu/en/news/eu-rules-general-purpose-ai-models-start-apply-bringing-more-transparency-safety-and-accountability)

<!-- event: 2025-08-05; actors: OpenAI,Anthropic; tags: model,open-weights,coding -->
### August 5, 2025 — OpenAI returns to open weights; Anthropic ships Opus 4.1

**Development.** OpenAI released Apache-2.0 gpt-oss-120b and 20b; Anthropic upgraded its premium coding/agent model. **Technical change.** GPT-oss used sparse MoE activation, configurable reasoning, tool use, and harmony-formatted chains, with 120B fitting one 80 GB GPU and 20B fitting 16 GB. Opus 4.1 improved agentic coding and research without changing price. **What it meant.** DeepSeek/Qwen pressure forced OpenAI back into downloadable models, while Anthropic defended the closed premium frontier through incremental agent quality. **Contemporary reaction.** OpenAI’s license and local deployability were applauded; users noted GPT-oss was not its strongest model and safety still depended on deployment. **Power shift.** **Gained:** open model users, OpenAI distribution, Anthropic coders. **Lost:** Meta/Qwen’s exclusive open mindshare.

**Sources:** [OpenAI: gpt-oss](https://openai.com/index/introducing-gpt-oss/); [Anthropic: Claude Opus 4.1](https://www.anthropic.com/news/claude-opus-4-1)

<!-- event: 2025-08-07; actors: OpenAI; tags: model,reasoning,agents -->
### August 7, 2025 — GPT-5 unifies fast responses, reasoning, and routing

**Development.** OpenAI made GPT-5 the default ChatGPT system and released API GPT-5, mini, and nano tiers. **Technical change.** A real-time router selected a fast model or deeper reasoning based on task and user intent; the API added controllable reasoning/verbosity, strong coding, long tool chains, and improved honesty/health behavior. **What it meant.** The GPT/o-series split became an invisible system decision, making model orchestration part of the flagship product. **Contemporary reaction.** Coding and agent evaluations impressed, but users who preferred GPT-4o’s personality objected to forced migration, leading OpenAI to restore model choice and tune warmth. **Power shift.** **Gained:** OpenAI’s platform integration and developers using one family. **Lost:** older GPT-4/o models and users’ control at launch.

**Sources:** [OpenAI: GPT-5 for developers](https://openai.com/index/introducing-gpt-5-for-developers/); [OpenAI: GPT-5 and work](https://openai.com/index/gpt-5-new-era-of-work/)

<!-- event: 2025-08-21; actors: DeepSeek,Cohere; tags: model,agents,reasoning -->
### August 21, 2025 — DeepSeek-V3.1 and Command A Reasoning strengthen efficient agents

**Development.** DeepSeek released a hybrid thinking/non-thinking update with stronger tool use; Cohere released an enterprise reasoning member of Command A. **Technical change.** V3.1 unified chat and reasoner paths in one 671B MoE, expanded context and agent training, and introduced a tokenizer change; Cohere optimized verifiable stepwise reasoning, multilingual enterprise tasks, citations, and private deployment. **What it meant.** Hybrid reasoning and tools became standard across both open Chinese models and enterprise specialists. **Contemporary reaction.** Developers welcomed V3.1’s low price and agent gains but disliked compatibility-breaking tokenizer changes; Cohere remained respected but less visible. **Power shift.** **Gained:** DeepSeek and Cohere niches. **Lost:** separate model endpoints and generic enterprise chat.

**Sources:** [DeepSeek-V3.1 release](https://api-docs.deepseek.com/news/news250821); [Cohere model documentation](https://docs.cohere.com/docs/command-a-reasoning)

<!-- event: 2025-09-02; actors: Anthropic; tags: company,funding -->
### September 2, 2025 — Anthropic raises $13 billion at $183 billion

**Development.** Series F financing followed rapid Claude Code and enterprise growth; Anthropic reported run-rate revenue rising from about $1 billion at the start of 2025 to above $5 billion by August. **Technical change.** The round bought compute, international distribution, and product capacity. **What it meant.** Anthropic’s coding-first momentum translated into the fastest credible commercial challenge to OpenAI, reducing pressure to sell to Amazon or Google. **Contemporary reaction.** Investors rewarded execution; observers questioned whether multiple labs could sustain similar infrastructure burn. **Power shift.** **Gained:** Anthropic’s independence and employees/investors. **Lost:** OpenAI’s enterprise narrative and smaller model vendors’ access to capital.

**Source:** [Anthropic Series F](https://www.anthropic.com/news/anthropic-raises-series-f-at-usd183b-post-money-valuation)

<!-- event: 2025-09-05; actors: Moonshot AI; tags: model,agents,open-weights -->
### September 5, 2025 — Kimi K2-Instruct-0905 improves context and agent stability

**Development.** Moonshot refreshed K2’s instruction weights and hosted context. **Technical change.** Better coding, frontend generation, tool-call formatting, and longer context addressed weaknesses discovered after the initial open release without retraining the trillion-parameter base. **What it meant.** Frequent open-weight post-training updates became a competitive rhythm comparable to API vendors’ silent revisions. **Contemporary reaction.** The practical gains kept K2 relevant amid GPT-5 and Qwen3-Coder, though version fragmentation grew. **Power shift.** **Gained:** Moonshot’s agent ecosystem. **Lost:** fixed annual release cycles.

**Source:** [Kimi release index](https://www.kimi.com/en/blog/)

<!-- event: 2025-09-10; actors: Alibaba,Qwen; tags: model,hybrid-attention,moe -->
### September 10–24, 2025 — Qwen3-Next and Qwen3-Max split efficiency from scale

**Development.** Alibaba released open 80B/3B-active Next models and a proprietary trillion-plus-parameter Max flagship. **Technical change.** Next interleaved Gated DeltaNet linear attention with standard attention, used ultra-sparse MoE and multi-token prediction, and delivered more than 10× long-context throughput; Max trained on 36T tokens for coding/agents and previewed deeper thinking. **What it meant.** Alibaba pursued two frontiers at once: radical open efficiency and maximum closed scale. **Contemporary reaction.** Next’s 3B active footprint drew technical enthusiasm; Max’s closed weights made claims harder to audit. **Power shift.** **Gained:** Qwen/Alibaba Cloud and hybrid attention. **Lost:** dense attention’s default status and one-size-fits-all families.

**Sources:** [Qwen3-Next](https://qwen.ai/blog?id=qwen3-next); [Qwen3-Max](https://qwen.ai/blog?id=qwen3-max)

<!-- event: 2025-09-15; actors: OpenAI; tags: model,coding-agents -->
### September 15, 2025 — GPT-5-Codex specializes one model for interactive and long-running work

**Development.** OpenAI upgraded Codex across terminal, IDE, web, and GitHub with a coding-specialized GPT-5 variant. **Technical change.** Dynamic compute allocation let it respond quickly to small tasks or work independently for hours on refactors, code review, debugging, and tests; it adhered more closely to AGENTS.md instructions. **What it meant.** Coding-model design increasingly targeted the harness’s temporal rhythm rather than static code completion. **Contemporary reaction.** Developers reported major persistence gains; Claude Code remained the primary workflow rival. **Power shift.** **Gained:** OpenAI Codex. **Lost:** generic GPT-5 for difficult software tasks and independent IDE differentiation.

**Source:** [OpenAI: Codex upgrades](https://openai.com/index/introducing-upgrades-to-codex/)

<!-- event: 2025-09-19; actors: xAI; tags: model,reasoning,efficiency -->
### September 19, 2025 — Grok 4 Fast compresses flagship reasoning into a cheap 2M-context model

**Development.** xAI released one set of weights supporting reasoning and non-reasoning modes. **Technical change.** Long context, native web/X/code tools, and post-training efficiency delivered comparable search performance with a claimed 40% fewer thinking tokens and radically lower cost than Grok 4. **What it meant.** xAI shifted from benchmark-maximal Heavy compute toward price/performance and agent traffic. **Contemporary reaction.** Developers welcomed the cost drop; trust and safety concerns around Grok’s consumer behavior persisted. **Power shift.** **Gained:** xAI API competitiveness. **Lost:** Grok 4’s price premium and smaller search-agent models.

**Source:** [xAI: Grok 4 Fast](https://x.ai/news/grok-4-fast)

<!-- event: 2025-09-29; actors: Anthropic,California; tags: model,agents,regulation -->
### September 29, 2025 — Claude Sonnet 4.5 ships as California signs SB 53

**Development.** Anthropic released a stronger coding/computer-use model and an Agent SDK; California enacted frontier-model transparency and serious-incident reporting requirements. **Technical change.** Sonnet improved long-horizon autonomous coding, computer interaction, and context management; the law required large developers to publish safety frameworks and report critical incidents while protecting whistleblowers. **What it meant.** Agent capability and enforceable safety process advanced together in the U.S. frontier industry’s home state. **Contemporary reaction.** Developers embraced Sonnet as a practical default; SB 53 was viewed as a narrower, more workable successor to vetoed SB 1047. **Power shift.** **Gained:** Anthropic’s coding lead and California oversight. **Lost:** opaque frontier-safety practice.

**Sources:** [Anthropic: Claude Sonnet 4.5](https://www.anthropic.com/news/claude-sonnet-4-5); [California SB 53](https://www.gov.ca.gov/2025/09/29/governor-newsom-signs-sb-53-advancing-californias-world-leading-artificial-intelligence-industry/)

<!-- event: 2025-09-30; actors: Zhipu; tags: model,coding,agents -->
### September 30, 2025 — GLM-4.6 extends context and coding performance

**Development.** Zhipu upgraded its open flagship generation. **Technical change.** Context rose from 128K to 200K, with stronger code editing, reasoning, tool use, and more efficient token use for agents. **What it meant.** Zhipu matched the rapid open-model refresh cadence of Qwen and DeepSeek and strengthened its coding products. **Contemporary reaction.** The model gained usage through low-cost APIs and local hosts, though naming overlap with vision variants grew confusing. **Power shift.** **Gained:** GLM and China’s multi-lab resilience. **Lost:** slower open release cycles.

**Source:** [Z.ai: GLM-4.6](https://z.ai/blog/glm-4.6)

<!-- event: 2025-10-06; actors: OpenAI; tags: tooling,agents,platform -->
### October 6, 2025 — AgentKit tries to make the whole agent lifecycle an OpenAI product

**Development.** OpenAI launched visual Agent Builder, Connector Registry, ChatKit, datasets, trace grading, and prompt optimization. **Technical change.** Design, connectors, embedded UI, evaluation, deployment, and observability became one managed stack above Responses API. **What it meant.** OpenAI sought the control plane for enterprise agents, competing with cloud workflow tools and independent observability vendors. **Contemporary reaction.** No-code speed attracted enterprises; lock-in and overlap with the open Agents SDK drew criticism. OpenAI later announced the visual Builder/Evals products would wind down in 2026. **Power shift.** **Gained:** OpenAI’s enterprise platform temporarily. **Lost:** fragmented agent tooling—then AgentKit itself lost momentum to code/skills-based workflows.

**Source:** [OpenAI: AgentKit](https://openai.com/index/introducing-agentkit/)

<!-- event: 2025-10-13; actors: OpenAI,Broadcom; tags: hardware,custom-silicon,company -->
### October 13, 2025 — OpenAI and Broadcom announce custom AI accelerators

**Development.** The companies said OpenAI-designed accelerators and Broadcom networking would begin deploying in racks in late 2026. **Technical change.** Custom XPUs co-designed for OpenAI workloads, high-bandwidth scale-up/out Ethernet, and rack-level systems aimed to internalize model–hardware optimization. **What it meant.** OpenAI sought leverage over NVIDIA cost and supply, while Broadcom graduated from Google/Meta custom silicon and networking into a visible frontier-lab partnership. **Contemporary reaction.** The scale impressed; circular financing, execution risk, and the continuing need for NVIDIA training clusters generated skepticism. **Power shift.** **Gained:** OpenAI sovereignty and Broadcom’s XPU franchise. **Lost:** future NVIDIA share and Microsoft exclusivity.

**Source:** [AP: OpenAI–Broadcom partnership](https://apnews.com/article/1bef0e0216d3878feefcb003e89b08e4)

<!-- event: 2025-10-15; actors: Anthropic; tags: model,small-model,agents -->
### October 15, 2025 — Claude Haiku 4.5 brings near-frontier coding to the fast tier

**Development.** Anthropic released a small, low-latency model with computer-use and agent capabilities. **Technical change.** It approached earlier Sonnet 4 coding at roughly one-third the cost and more than twice the speed, allowing multiple Haiku subagents to support a stronger coordinator. **What it meant.** Small models became active workers inside multi-agent systems rather than mere classifiers or routers. **Contemporary reaction.** Price/performance was well received; organizations still reserved complex planning for Sonnet/Opus. **Power shift.** **Gained:** Anthropic’s volume tier and multi-agent economics. **Lost:** older Claude 3 Haiku and generic small models.

**Source:** [Anthropic: Claude Haiku 4.5](https://www.anthropic.com/news/claude-haiku-4-5)

<!-- event: 2025-10-28; actors: OpenAI,Microsoft; tags: company,governance -->
### October 28, 2025 — OpenAI completes its public-benefit recapitalization

**Development.** The nonprofit became the OpenAI Foundation, continued controlling OpenAI Group PBC, and held conventional equity valued around $130 billion; Microsoft’s rights and ownership were reset. **Technical change.** Governance and capital structure—not a model—changed: investors gained normal equity upside while the foundation retained appointment/control powers and mission-focused safety authority. **What it meant.** OpenAI removed a major fundraising constraint without fully abandoning nonprofit control. **Contemporary reaction.** Supporters called it a pragmatic mission/capital balance; critics saw commercialization winning and questioned enforceability of public benefit. **Power shift.** **Gained:** OpenAI’s ability to raise infrastructure capital, Microsoft liquidity, and the foundation’s paper wealth. **Lost:** the original capped-profit mechanism and some governance simplicity.

**Source:** [OpenAI structure](https://openai.com/our-structure/)

<!-- event: 2025-11-06; actors: Moonshot AI; tags: model,reasoning,agents -->
### November 6, 2025 — Kimi K2 Thinking targets long-horizon tool reasoning

**Development.** Moonshot released a reasoning-tuned K2 variant. **Technical change.** The model could sustain long chains with web/code tools, repeatedly inspect observations, and revise plans, bringing the trillion-parameter MoE into the “thinking agent” category. **What it meant.** Kimi’s strategy evolved from long context to open agentic reasoning, intensifying Chinese competition with DeepSeek and Qwen. **Contemporary reaction.** Performance drew strong developer interest; very long traces and serving requirements made efficient harnesses essential. **Power shift.** **Gained:** Moonshot and open long-horizon agents. **Lost:** proprietary deep-research models’ scarcity.

**Source:** [Moonshot: Kimi K2 Thinking](https://www.kimi.com/en/blog/kimi-k2-thinking)

<!-- event: 2025-11-13; actors: OpenAI; tags: model,reasoning,coding -->
### November 13–19, 2025 — GPT-5.1 and Codex-Max make reasoning adaptive and persistent

**Development.** OpenAI released GPT-5.1 Instant/Thinking for ChatGPT and API, followed by GPT-5.1-Codex-Max. **Technical change.** Adaptive reasoning spent less compute on easy tasks, a no-reasoning mode cut latency, prompt caching extended, and native shell/apply-patch tools improved agent work. Codex-Max used compaction to continue across multiple context windows. **What it meant.** Long-running reliability depended on state compression and harness-native actions, not simply a larger window. **Contemporary reaction.** Users welcomed warmer chat and faster routine work; version churn continued to frustrate stable deployments. **Power shift.** **Gained:** OpenAI’s persistent coding agents. **Lost:** static reasoning budgets and single-window agents.

**Sources:** [OpenAI: GPT-5.1](https://openai.com/index/gpt-5-1-for-developers/); [GPT-5.1-Codex-Max](https://openai.com/index/gpt-5-1-codex-max/)

<!-- event: 2025-11-17; actors: xAI; tags: model,product,agents -->
### November 17–19, 2025 — Grok 4.1 and 4.1 Fast improve personality and agent APIs

**Development.** xAI upgraded the consumer model, then released a fast two-million-context API variant. **Technical change.** Preference post-training targeted emotional intelligence, style, lower hallucination, and creative collaboration; Fast added web/X/code/document and remote MCP tool endpoints. **What it meant.** xAI separated the social assistant’s personality from a low-cost agent backbone while using one real-time data advantage. **Contemporary reaction.** Blind preference tests improved, but safety and political-bias concerns stayed attached to the brand. **Power shift.** **Gained:** xAI’s consumer and API breadth. **Lost:** earlier Grok 4 variants.

**Sources:** [xAI: Grok 4.1](https://x.ai/news/grok-4-1); [xAI: Grok 4.1 Fast](https://x.ai/news/grok-4-1-fast)

<!-- event: 2025-11-18; actors: Google; tags: model,agents,multimodal -->
### November 18, 2025 — Gemini 3 Pro and Antigravity put agent workflows at Google’s center

**Development.** Google previewed Gemini 3 Pro across the Gemini app, Search, API, Vertex, and a new agentic development environment; Deep Think followed for high-compute reasoning. **Technical change.** The model improved multimodal reasoning, coding, tool use, and visual UI generation; Antigravity let agents plan and operate editor, terminal, and browser while producing reviewable artifacts. **What it meant.** Google finally launched a frontier model into consumer, search, cloud, and agent products on day one. **Contemporary reaction.** The coordinated release was widely seen as a momentum turn; pricing and preview reliability remained concerns. **Power shift.** **Gained:** Google’s integrated distribution and developer agent. **Lost:** OpenAI/Anthropic’s exclusive coding-agent narrative.

**Source:** [Google: Gemini 3](https://blog.google/products-and-platforms/products/gemini/gemini-3/)

<!-- event: 2025-11-24; actors: Anthropic; tags: model,coding,agents -->
### November 24, 2025 — Claude Opus 4.5 strengthens long-running professional work

**Development.** Anthropic replaced Opus 4.1 with a flagship for software engineering, computer use, research, and documents. **Technical change.** Better planning, context management, and self-correction improved multi-step agent reliability while token efficiency lowered the effective cost of difficult tasks. **What it meant.** Anthropic defended premium intelligence through execution quality rather than a new modality or extreme context headline. **Contemporary reaction.** Coding and enterprise users responded strongly; API price still reserved Opus for high-value work. **Power shift.** **Gained:** Anthropic’s high-end agent position. **Lost:** Claude Opus 4.1 and GPT-5.1 in some coding workflows.

**Source:** [Anthropic: Claude Opus 4.5](https://www.anthropic.com/news/claude-opus-4-5)

<!-- event: 2025-12-01; actors: DeepSeek; tags: model,reasoning,agents -->
### December 1, 2025 — DeepSeek-V3.2 brings thinking into tool calls

**Development.** DeepSeek released standard and high-compute “Speciale” variants. **Technical change.** Agent post-training across 1,800 environments and 85,000 complex instructions taught the model to reason while using tools, not before or after them; sparse attention improved long context. **What it meant.** DeepSeek answered closed agent models while maintaining open weights and aggressive pricing. **Contemporary reaction.** Speciale’s benchmark scores impressed, but high reasoning length and limited hosted access constrained everyday use. **Power shift.** **Gained:** DeepSeek and open agent research. **Lost:** Western tool-reasoning exclusivity.

**Source:** [DeepSeek-V3.2](https://api-docs.deepseek.com/news/news251201)

<!-- event: 2025-12-08; actors: Zhipu; tags: model,vision,tool-use -->
### December 8–22, 2025 — GLM-4.6V and GLM-4.7 unify visual agents and coding

**Development.** Zhipu released a 106B multimodal model plus a free 9B Flash variant, then a stronger general/coding flagship. **Technical change.** GLM-4.6V offered native function calling from visual input and 128K multimodal context; GLM-4.7 improved reasoning, tool use, UI generation, and “vibe coding.” **What it meant.** Visual perception became an actionable tool-routing signal inside an open Chinese family. **Contemporary reaction.** Builders valued the 9B local option and coding gains; rapid numbering obscured which checkpoint fit which task. **Power shift.** **Gained:** Zhipu’s multimodal agent stack. **Lost:** vision models without actions.

**Sources:** [Z.ai: GLM-4.6V](https://z.ai/blog/glm-4.6v); [Z.ai: GLM-4.7](https://z.ai/blog/glm-4.7)

<!-- event: 2025-12-09; actors: Anthropic,OpenAI,Linux Foundation; tags: tooling,protocol,governance -->
### December 9, 2025 — MCP moves to the Linux Foundation’s Agentic AI Foundation

**Development.** Anthropic donated MCP to a foundation co-founded with Block and OpenAI, supported by Google, Microsoft, AWS, Cloudflare, and others; OpenAI contributed AGENTS.md and Block contributed goose. **Technical change.** Neutral governance, a registry, asynchronous/stateless protocol improvements, identity, extensions, and multi-language SDKs matured the standard. **What it meant.** Core agent interfaces became shared infrastructure rather than an Anthropic-controlled advantage. **Contemporary reaction.** The cross-industry coalition was treated as confirmation that MCP had won the connector standard race. **Power shift.** **Gained:** Linux Foundation, open agent standards, tool developers. **Lost:** any single vendor’s control of agent interoperability.

**Source:** [Anthropic: MCP donation and AAIF](https://www.anthropic.com/news/donating-the-model-context-protocol-and-establishing-of-the-agentic-ai-foundation)

<!-- event: 2025-12-11; actors: OpenAI; tags: model,agents,professional-work -->
### December 11–18, 2025 — GPT-5.2 and GPT-5.2-Codex target professional and persistent work

**Development.** OpenAI released Instant, Thinking, Pro, then a coding-specialized variant. **Technical change.** Long-context reasoning, spreadsheets/presentations, tool use, vision, and long-running agents improved; Codex added compaction, large refactors/migrations, stronger Windows support, and defensive-cyber capability. **What it meant.** The product benchmark shifted from academic questions toward complete economic tasks and multi-hour repository change. **Contemporary reaction.** Enterprise evaluations improved, while users saw less dramatic conversational difference and continued release fatigue. **Power shift.** **Gained:** OpenAI’s knowledge-work and coding stack. **Lost:** GPT-5.1 and point document tools.

**Sources:** [OpenAI: GPT-5.2](https://openai.com/index/introducing-gpt-5-2/); [GPT-5.2-Codex](https://openai.com/index/introducing-gpt-5-2-codex/)

<!-- event: 2025-12-24; actors: NVIDIA,Groq; tags: hardware,inference,company -->
### December 24, 2025 — NVIDIA licenses Groq’s inference technology and hires its leaders

**Development.** Groq entered a nonexclusive licensing agreement; founder Jonathan Ross, president Sunny Madra, and other staff joined NVIDIA while GroqCloud continued independently. **Technical change.** Compiler-scheduled LPU inference expertise could be integrated beside NVIDIA GPUs and software, especially for deterministic low-latency decode. **What it meant.** NVIDIA absorbed a credible architectural threat rather than waiting for it to scale, foreshadowing Groq LPUs inside the Rubin platform. **Contemporary reaction.** The reported deal value looked acquisition-like despite the nonexclusive form; customers questioned Groq’s independent roadmap. **Power shift.** **Gained:** NVIDIA’s inference portfolio and Groq investors/team. **Lost:** Groq’s strategic independence and the alternative-hardware field’s strongest pure-play brand.

**Source:** [Groq announcement](https://groq.com/newsroom/groq-and-nvidia-enter-non-exclusive-inference-technology-licensing-agreement-to-accelerate-ai-inference-at-global-scale)

---

# 2026 — Durable agents, tiered intelligence, and inference specialization

<!-- event: 2026-01-06; actors: xAI,NVIDIA,Cisco; tags: company,capital,compute -->
### January 6, 2026 — xAI raises $20 billion to scale Colossus and Grok

**Development.** xAI closed an upsized Series E backed by financial investors plus NVIDIA and Cisco. **Technical change.** The financing supported Colossus I and II, which xAI said ended 2025 above one million H100-equivalent GPUs, and further reinforcement-learning compute for the Grok 4 line. **What it meant.** Compute procurement, real-time X distribution, consumer reach, and model training were being financed as one vertically integrated system. **Contemporary reaction.** The round confirmed xAI as a capital-scale frontier lab, although its self-reported compute and user figures were difficult to compare with audited rivals. **Power shift.** **Gained:** xAI, NVIDIA, and large sovereign/financial backers. **Lost:** smaller labs unable to finance gigawatt-scale infrastructure.

**Source:** [xAI: Series E](https://x.ai/news/series-e)

<!-- event: 2026-01-08; actors: Zhipu,GLM,HKEX; tags: company,capital,china -->
### January 8, 2026 — Zhipu becomes the first major foundation-model pure play to list publicly

**Development.** Knowledge Atlas Technology, the company behind Z.ai and GLM, listed in Hong Kong after raising about $552–558 million. **Technical change.** An IPO is not a model upgrade, but public capital gave an independent Chinese lab a new route to finance pretraining, inference subsidies, and domestic accelerator work. **What it meant.** Frontier-model economics became visible through a public company, and Hong Kong became a financing venue for China’s “AI tiger” cohort. **Contemporary reaction.** Shares finished the debut about 13% above the offer price, signaling appetite for the sector, while reporting emphasized Zhipu’s large losses relative to revenue. **Power shift.** **Gained:** Zhipu, Hong Kong’s exchange, and investors seeking direct model exposure. **Lost:** private investors’ exclusive access and rivals still dependent on serial venture rounds.

**Sources:** [HKEX listing document](https://www1.hkexnews.hk/listedco/listconews/sehk/2026/0108/11984305/sehk25121901750.pdf); [Reuters: debut and market reaction](https://www.marketscreener.com/news/chinese-tech-firms-rise-in-hong-kong-debut-as-us-china-tech-race-heats-up-ce7e59dcd08cf120)

<!-- event: 2026-01-12; actors: Anthropic; tags: product,agents,governance -->
### January 12–22, 2026 — Claude Cowork and a new constitution broaden Anthropic’s agent thesis

**Development.** Anthropic previewed Cowork, a desktop agent derived from Claude Code, created Anthropic Labs to accelerate experimental products, and published a substantially rewritten Claude constitution. **Technical change.** Cowork applied filesystem access, tools, plans, and user review to general knowledge work; the constitution moved from a list of prohibitions toward reasoned principles, while remaining an input to training rather than a hard runtime rule. **What it meant.** Anthropic tried to transfer Claude Code’s execution loop to non-programmers without abandoning its safety-centered identity. **Contemporary reaction.** Claude Code’s reported billion-dollar run rate and MCP’s more than 100 million downloads made the expansion credible; desktop autonomy renewed concerns over permissions and accidental destructive actions. **Power shift.** **Gained:** Anthropic’s product surface and constitutional-AI narrative. **Lost:** stand-alone desktop automation tools and Claude’s coding-only positioning.

**Sources:** [Anthropic: Anthropic Labs](https://www.anthropic.com/news/introducing-anthropic-labs); [Claude’s new constitution](https://www.anthropic.com/news/claude-new-constitution)

<!-- event: 2026-01-14; actors: OpenAI,Cerebras; tags: hardware,inference,partnership -->
### January 14, 2026 — OpenAI contracts 750 MW of Cerebras inference capacity

**Development.** OpenAI and Cerebras announced a multi-year deployment of 750 megawatts of Cerebras systems through 2028. **Technical change.** Cerebras’s wafer-scale engines keep weights and bandwidth close to compute, targeting very high per-user token rates and low response latency rather than merely maximum batch throughput. **What it meant.** OpenAI diversified beyond GPU-only serving and made latency a first-class model-product variable. **Contemporary reaction.** The scale validated wafer-scale inference, while observers noted that delivery, power, and economics—not a demo benchmark—would determine the partnership’s impact. **Power shift.** **Gained:** Cerebras and OpenAI’s supplier leverage. **Lost:** NVIDIA’s exclusivity at the inference layer, at least at the margin.

**Source:** [OpenAI: Cerebras partnership](https://openai.com/index/cerebras-partnership/)

<!-- event: 2026-01-25; actors: Alibaba,Qwen; tags: model,reasoning,tools -->
### January 25, 2026 — Qwen3-Max-Thinking makes tool use part of test-time scaling

**Development.** Alibaba released the reasoning form of its largest proprietary Qwen3 model. **Technical change.** The model combined adaptive tool use with self-reflection, allowing it to decide when to search, execute code, or reconsider intermediate results during a longer reasoning trajectory. **What it meant.** China’s largest cloud vendor was no longer competing only through open checkpoints; it also had a premium, hosted reasoning tier. **Contemporary reaction.** Strong benchmark results drew attention, but the closed weights and high-compute inference made it a different proposition from Qwen’s popular open models. **Power shift.** **Gained:** Alibaba Cloud’s premium API. **Lost:** the idea that Qwen’s strategic leverage came only from open-weight distribution.

**Source:** [Qwen: Qwen3-Max-Thinking](https://qwen.ai/blog?id=qwen3-max-thinking)

<!-- event: 2026-01-27; actors: Moonshot AI,Kimi; tags: model,multimodal,agents -->
### January 27–February 9, 2026 — Kimi K2.5 and Agent Swarm parallelize multimodal work

**Development.** Moonshot released Kimi K2.5, then previewed an agent-swarm mode. **Technical change.** K2.5 added native visual understanding to the K2 agent foundation; the swarm decomposed a job across concurrent subagents and synthesized their outputs instead of relying on one serial trajectory. **What it meant.** Parallel inference became a user-facing capability and a new way to spend test-time compute. **Contemporary reaction.** The demos made Moonshot look technically adventurous; cost, coordination errors, and reproducibility tempered enthusiasm for swarm benchmark gains. **Power shift.** **Gained:** Moonshot’s agent differentiation. **Lost:** serial-only research assistants and labs without spare inference capacity.

**Sources:** [Kimi: Kimi K2.5](https://www.kimi.com/en/blog/kimi-k2-5); [Kimi: Agent Swarm](https://www.kimi.com/en/blog/agent-swarm)

<!-- event: 2026-01-27; actors: Mistral; tags: model,coding,agents,open-weights -->
### January 27–March 17, 2026 — Mistral Vibe, Small 4, and Forge sharpen Europe’s sovereign stack

**Development.** Mistral upgraded its terminal coding agent, released Mistral Small 4 under Apache 2.0, and launched Forge for training enterprise-specific frontier models. **Technical change.** Vibe 2.0 added custom subagents, skills, clarification, and configurable permissions; Small 4 unified text/image input, coding, and selectable reasoning in a 119B-parameter MoE with about 6B active parameters and 256K context; Forge adapted models to proprietary organizational data. **What it meant.** Mistral’s strategy combined an efficient open worker, an agent harness, and private model-building rather than trying to outspend U.S. labs on one giant general model. **Contemporary reaction.** European and on-premises buyers welcomed the license and small active footprint; the flagship capability gap and requirement for multi-GPU serving still constrained mass local use. **Power shift.** **Gained:** Mistral, sovereign-AI buyers, and European model autonomy. **Lost:** closed-only enterprise vendors and older Mistral specialist checkpoints consolidated by Small 4.

**Sources:** [Mistral: Vibe 2.0](https://mistral.ai/news/mistral-vibe-2-0/); [Mistral Small 4](https://mistral.ai/news/mistral-small-4/); [Mistral Forge](https://mistral.ai/news/forge/)

<!-- event: 2026-02-02; actors: xAI,SpaceX; tags: company,compute,distribution -->
### February 2, 2026 — SpaceX acquires xAI

**Development.** SpaceX announced that it had acquired xAI. **Technical change.** The transaction placed Grok, X-derived real-time data, Colossus data centers, satellite connectivity, launch capacity, and a proposed orbital-compute program under one corporate roof. **What it meant.** xAI’s resource base expanded from an AI/social platform to a space, communications, energy, and compute conglomerate. **Contemporary reaction.** Supporters saw an unmatched infrastructure flywheel; critics saw governance, valuation, and related-party risk concentrated around Elon Musk. **Power shift.** **Gained:** the combined SpaceXAI capital and infrastructure stack. **Lost:** xAI’s stand-alone governance and rivals without captive communications or launch assets.

**Source:** [xAI: xAI joins SpaceX](https://x.ai/news/xai-joins-spacex)

<!-- event: 2026-02-02; actors: OpenAI; tags: tooling,coding,agents -->
### February 2–5, 2026 — Codex becomes a multi-agent desktop, then gets GPT-5.3-Codex

**Development.** OpenAI launched the Codex macOS app and three days later released GPT-5.3-Codex. **Technical change.** The app coordinated concurrent agents in isolated worktrees with reusable skills, automations, review, and sandboxing; the model improved long-running tool work and ran about 25% faster than its predecessor. **What it meant.** A coding harness became a persistent command center, and model/harness co-design became part of the product advantage. **Contemporary reaction.** Developers welcomed parallel work and artifact review, while asking how much autonomy could be trusted in real repositories; OpenAI classified the model at its first “High” cyber-capability threshold. **Power shift.** **Gained:** OpenAI’s end-to-end coding platform. **Lost:** single-agent editor extensions and generic chat-based coding.

**Sources:** [OpenAI: Codex app](https://openai.com/index/introducing-the-codex-app/); [GPT-5.3-Codex](https://openai.com/index/introducing-gpt-5-3-codex/)

<!-- event: 2026-02-05; actors: Anthropic; tags: model,coding,agents,inflection-point -->
### February 5, 2026 — Claude Opus 4.6 in Claude Code makes sustained delegation feel real

**Development.** Anthropic released Opus 4.6 across Claude, Claude Code, and the API. **Technical change.** A one-million-token context window entered beta, alongside better long-horizon planning, coding, computer use, and context retention. **What it meant.** Anthropic answered Codex’s persistence with a premium model designed to stay coherent across very large projects. **Contemporary reaction.** Enterprise and coding users viewed it as a strong new ceiling; price and the operational difficulty of one-million-token prompts limited routine use. **Power shift.** **Gained:** Anthropic’s premium agent tier. **Lost:** Opus 4.5 and smaller-context incumbents.

**Why it felt different.** In Claude Code, the improvement was not simply better autocomplete or a higher coding score. The model could inspect a substantial codebase, form and revise a plan, use tools, preserve intent through long runs, recover from errors, and return a coherent change for review. For many practitioners, the governing metaphor changed from *pair-programming with a chatbot* to *managing an unusually fast junior-to-mid-level engineer*—still fallible and in need of supervision, but capable of owning a meaningful unit of work.

**Source:** [Anthropic: Claude Opus 4.6](https://www.anthropic.com/news/claude-opus-4-6)

<!-- event: 2026-02-12; actors: OpenAI,Cerebras; tags: model,inference,hardware -->
### February 12, 2026 — GPT-5.3-Codex-Spark previews interactive coding above 1,000 tokens per second

**Development.** OpenAI previewed a compact Codex variant on Cerebras hardware for ChatGPT Pro users. **Technical change.** Spark used a 128K text context and a latency-optimized stack that OpenAI reported could exceed 1,000 output tokens per second. **What it meant.** Coding split into at least two product modes: deep asynchronous agency and near-instant interactive iteration. **Contemporary reaction.** The speed felt qualitatively different, but restricted access, text-only input, and a smaller context made it a complement rather than a replacement. **Power shift.** **Gained:** Cerebras and OpenAI’s real-time coding experience. **Lost:** GPU-serving stacks optimized only for aggregate throughput.

**Source:** [OpenAI: GPT-5.3-Codex-Spark](https://openai.com/index/introducing-gpt-5-3-codex-spark/)

<!-- event: 2026-02-12; actors: Zhipu,GLM; tags: model,open-weights,hardware -->
### February 12, 2026 — GLM-5 scales open agent reasoning on non-NVIDIA training hardware

**Development.** Zhipu released GLM-5 under the MIT license. **Technical change.** The 744B-parameter mixture-of-experts model activated roughly 40B parameters per token, trained on 28.5T tokens, used DeepSeek Sparse Attention, and used the `slime` asynchronous reinforcement-learning system; Zhipu emphasized training on domestic accelerators. **What it meant.** A Chinese lab showed that frontier-scale open models and agent RL could advance despite U.S. access restrictions. **Contemporary reaction.** The scale and license impressed the open community; deployment remained demanding and benchmark claims needed independent replication. **Power shift.** **Gained:** Zhipu, Chinese accelerator ecosystems, and open-model builders. **Lost:** export controls’ ability to freeze model progress and smaller local-deployment footprints.

**Source:** [Z.ai: GLM-5](https://z.ai/blog/glm-5)

<!-- event: 2026-02-12; actors: Google; tags: model,reasoning,science -->
### February 12–19, 2026 — Gemini 3 Deep Think and 3.1 Pro raise Google’s reasoning ceiling

**Development.** Google upgraded its high-compute Deep Think mode, then introduced Gemini 3.1 Pro across the app, API, Vertex AI, and developer tools. **Technical change.** Deep Think used parallel reasoning for science, mathematics, and engineering; 3.1 Pro improved complex problem solving, coding, and multimodal understanding in the general flagship. **What it meant.** Google separated expensive deliberation from the broadly deployable frontier model while distributing both through its cloud and consumer surfaces. **Contemporary reaction.** Scientific and coding results were strong, though preview labels and shifting Gemini names still complicated procurement. **Power shift.** **Gained:** Google’s reasoning portfolio and Cloud. **Lost:** labs without both a high-compute mode and mass distribution.

**Sources:** [Google: Gemini 3 Deep Think](https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-3-deep-think/); [Gemini 3.1 Pro](https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-3-1-pro/)

<!-- event: 2026-02-12; actors: Anthropic; tags: company,capital,coding -->
### February 12–17, 2026 — Anthropic raises $30 billion and makes Sonnet 4.6 the default Claude

**Development.** Anthropic announced a $30 billion Series G at a $380 billion post-money valuation, then shipped Sonnet 4.6. **Technical change.** Sonnet brought a one-million-token beta window plus better coding, computer use, and agent planning to the mainstream price tier. **What it meant.** Claude’s most economically important model moved closer to the prior Opus frontier while Claude Code’s annualized revenue had reportedly passed $2.5 billion. **Contemporary reaction.** Investors endorsed Anthropic’s enterprise/coding momentum; the valuation magnified pressure to convert model leadership into durable margins. **Power shift.** **Gained:** Anthropic’s balance sheet and high-volume tier. **Lost:** Sonnet 4.5, Opus-only workflows, and smaller enterprise challengers.

**Sources:** [Anthropic: Series G](https://www.anthropic.com/news/anthropic-raises-30-billion-series-g-funding-380-billion-post-money-valuation); [Claude Sonnet 4.6](https://www.anthropic.com/news/claude-sonnet-4-6)

<!-- event: 2026-02-15; actors: Alibaba,Qwen; tags: model,open-weights,multimodal -->
### February 15, 2026 — Qwen3.5 unifies vision, long context, and efficient open inference

**Development.** Alibaba released an open-weight Qwen3.5 flagship. **Technical change.** The 397B-parameter mixture-of-experts model activated about 17B parameters, combined Gated DeltaNet with sparse attention, natively processed text and vision, supported 201 languages, and offered up to one million hosted tokens. **What it meant.** Open deployment no longer required choosing between multimodality, agent ability, or efficient activation. **Contemporary reaction.** Developers praised capability per active parameter and multilingual breadth; serving the full checkpoint still required serious infrastructure. **Power shift.** **Gained:** Qwen’s open ecosystem and Alibaba Cloud. **Lost:** older dense open models and Western-only multilingual assumptions.

**Source:** [Qwen: Qwen3.5](https://qwen.ai/blog?id=qwen3.5)

<!-- event: 2026-02-20; actors: Taalas,TSMC; tags: hardware,inference,specialization -->
### February 20, 2026 — Taalas HC1 hardwires a model for ultra-fast inference

**Development.** Taalas disclosed its first “hardcoded” model accelerator, manufactured on TSMC’s 6 nm process. **Technical change.** Instead of repeatedly fetching weights from external memory, HC1 embedded the model’s dataflow and weights into an 815 mm² chip; Taalas claimed roughly 17,000 Llama-3.1-8B tokens per second per user at about 2.5 kW. **What it meant.** Specialization challenged the assumption that every inference workload should run on a programmable GPU. **Contemporary reaction.** The speed/efficiency claim drew intense interest, but it was a vendor result for one small fixed model; flexibility, yield, and update economics were open questions. **Power shift.** **Gained:** Taalas and model-specific silicon. **Lost:** general-purpose accelerators on stable, very-high-volume models—if the economics held.

**Sources:** [Taalas: products and HC1 specifications](https://taalas.com/products/); [Taalas: path to ubiquitous AI](https://taalas.com/the-path-to-ubiquitous-ai/)

<!-- event: 2026-03-03; actors: Google; tags: model,inference,embeddings,tooling -->
### March 3–17, 2026 — Google fills out Gemini’s low-cost, embedding, and compound-tool layers

**Development.** Google released Gemini 3.1 Flash-Lite, Gemini Embedding 2, and Gemini API tooling updates. **Technical change.** Flash-Lite targeted high-volume low-cost inference; Embedding 2 mapped text, images, video, audio, and documents into one vector space; the API could combine built-in and custom tools and circulate context more efficiently. **What it meant.** Google addressed the full retrieval-and-agent pipeline, not only flagship reasoning. **Contemporary reaction.** Developers welcomed a coherent stack and cheaper serving, while benchmark churn made cross-generation comparisons difficult. **Power shift.** **Gained:** Google Cloud and end-to-end Gemini applications. **Lost:** point embedding vendors and orchestration glue built around one tool at a time.

**Sources:** [Google: Gemini 3.1 Flash-Lite](https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-3-1-flash-lite/); [Gemini Embedding 2](https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-embedding-2/); [Gemini API tooling updates](https://blog.google/innovation-and-ai/technology/developers-tools/gemini-api-tooling-updates/)

<!-- event: 2026-03-05; actors: OpenAI; tags: model,agents,computer-use -->
### March 5–17, 2026 — GPT-5.4, mini, and nano make computer use a model-family capability

**Development.** OpenAI launched GPT-5.4 Thinking/Pro, then GPT-5.4 mini and nano. **Technical change.** The flagship combined a one-million-token context with native computer use, stronger vision, and tool search; mini delivered a faster multimodal agent tier with up to 400K context, while nano targeted cheap focused tasks. **What it meant.** OpenAI exposed one capability ladder—from local subagents to premium professional work—rather than reserving agency for a single expensive model. **Contemporary reaction.** Computer use and professional-task gains were welcomed; the multiplying names, modes, and access tiers increased operational complexity. **Power shift.** **Gained:** OpenAI’s API segmentation and agent builders. **Lost:** GPT-5.2/5.3 variants and separate visual-RPA systems.

**Sources:** [OpenAI: GPT-5.4](https://openai.com/index/introducing-gpt-5-4/); [GPT-5.4 mini and nano](https://openai.com/index/introducing-gpt-5-4-mini-and-nano/)

<!-- event: 2026-03-11; actors: OpenAI; tags: tooling,agents,api -->
### March 11, 2026 — The Responses API gains a hosted computer, skills, and compaction

**Development.** OpenAI equipped API agents with a managed computer environment, reusable skills, and server-side context compaction. **Technical change.** Agents could execute in an isolated GUI/terminal, load procedural expertise on demand, and compress long histories without application-written summarization loops. **What it meant.** Capabilities that previously belonged to bespoke harnesses became managed primitives. **Contemporary reaction.** The lower integration burden appealed to enterprises; lock-in, auditability, and the security boundary of hosted execution remained central concerns. **Power shift.** **Gained:** OpenAI’s agent platform. **Lost:** undifferentiated orchestration middleware and home-grown sandbox plumbing.

**Source:** [OpenAI: computer environment, skills, and compaction](https://openai.com/index/equip-responses-api-computer-environment/)

<!-- event: 2026-03-16; actors: NVIDIA,Broadcom,TSMC,Groq; tags: hardware,networking,foundry -->
### March 16, 2026 — NVIDIA Vera Rubin enters production as networking becomes the AI factory

**Development.** NVIDIA announced full production of the Vera Rubin platform; the surrounding 2026 hardware cycle also brought Broadcom’s Tomahawk Ultra/Jericho4 scale-up and scale-out fabric. **Technical change.** Rubin integrated Vera CPUs, Rubin GPUs, NVLink 6, ConnectX-9, BlueField-4, Spectrum-6, and Groq-derived LPU inference; NVIDIA later claimed roughly 10× the agent-token throughput of Grace Blackwell at rack scale. Broadcom targeted about 250 ns switch latency and million-accelerator fabrics. **What it meant.** The competitive unit was no longer a GPU but a co-designed rack, network, compiler, and power/cooling system, ultimately dependent on TSMC fabrication and advanced packaging. **Contemporary reaction.** Customers welcomed production readiness and Ethernet alternatives, while power, cooling, supply concentration, and vendor lock-in dominated deployment discussion. **Power shift.** **Gained:** NVIDIA’s full stack, Broadcom’s networking/custom-silicon role, and TSMC’s foundry leverage. **Lost:** isolated accelerator designs without a rack-scale fabric.

**Sources:** [NVIDIA: Vera Rubin platform](https://nvidianews.nvidia.com/news/nvidia-vera-rubin-platform); [NVIDIA: full-production AI factory](https://nvidianews.nvidia.com/news/vera-rubin-full-production-agentic-ai-factory); [Broadcom at OFC 2026](https://investors.broadcom.com/news-releases/news-release-details/broadcom-showcases-industry-leading-solutions-scaling-ai)

<!-- event: 2026-03-31; actors: OpenAI; tags: company,capital,compute -->
### March 31, 2026 — OpenAI raises $122 billion for its next infrastructure phase

**Development.** OpenAI announced $122 billion in new financing. **Technical change.** The capital was not a model feature, but it financed a diversified portfolio of training, inference, data-center, energy, and distribution partnerships at a scale few firms could match. **What it meant.** Frontier-model competition became inseparable from sovereign-scale capital formation and capacity planning. **Contemporary reaction.** The amount reset expectations for AI financing; it also sharpened scrutiny of burn rate, circular supplier financing, and the revenue required to justify infrastructure commitments. **Power shift.** **Gained:** OpenAI’s procurement power and infrastructure partners. **Lost:** independent labs and cloud customers competing for the same power and accelerators.

**Source:** [OpenAI: accelerating the next phase of AI](https://openai.com/index/accelerating-the-next-phase-ai/)

<!-- event: 2026-04-07; actors: Zhipu,GLM; tags: model,agents,long-horizon -->
### April 7, 2026 — GLM-5.1 targets an eight-hour autonomous workday

**Development.** Zhipu released GLM-5.1 as a hosted upgrade. **Technical change.** The release emphasized up to eight hours of autonomous operation, a 200K context, stronger tool use, and better recovery across long trajectories. **What it meant.** Evaluation moved from completing a benchmark task to sustaining a work session. **Contemporary reaction.** Long-horizon claims captured attention, but users treated successful duration as workload-dependent rather than guaranteed autonomy. **Power shift.** **Gained:** Zhipu’s enterprise-agent proposition. **Lost:** GLM-5 and short-run agent benchmarks as sufficient evidence.

**Source:** [Z.ai release notes: GLM-5.1](https://docs.z.ai/release-notes/new-released)

<!-- event: 2026-04-07; actors: Anthropic; tags: cyber,model,governance -->
### April 7, 2026 — Claude Mythos previews restricted frontier cyber capability

**Development.** Anthropic introduced Mythos as a controlled cyber-defense preview under Project Glasswing. **Technical change.** The model/harness was optimized for long cyber investigations, exploit analysis, and tool-driven defensive work, with access restrictions and monitoring beyond the ordinary Claude product. **What it meant.** Labs began productizing high-risk capability through gated variants rather than either releasing it broadly or withholding it completely. **Contemporary reaction.** Defenders welcomed access to stronger automation; dual-use and unequal-access concerns intensified. **Power shift.** **Gained:** vetted defenders, Anthropic’s safety-case governance, and government oversight. **Lost:** open access to the strongest cyber capability.

**Source:** [Anthropic: Mythos preview](https://www.anthropic.com/research/mythos-preview)

<!-- event: 2026-04-15; actors: OpenAI,Alibaba,Qwen; tags: tooling,agents,model -->
### April 15–21, 2026 — Agent runtimes become durable while Qwen3.6 compresses open coding

**Development.** OpenAI previewed the next Agents SDK; Alibaba released Qwen3.6-35B-A3B and 27B, plus a proprietary Max preview. **Technical change.** OpenAI added model-native sandboxes, snapshots/rehydration, durable execution, multiple containers, and subagents. Qwen’s open 35B model activated about 3B parameters while combining multimodality and agentic coding; the dense 27B offered a simpler local option. **What it meant.** The contest operated at two layers: durable harness state above the model and much cheaper capable workers below it. **Contemporary reaction.** Builders welcomed resumable runs and small open subagents; platform dependence and uneven tool reliability remained concerns. **Power shift.** **Gained:** OpenAI’s runtime and Qwen’s open worker-model ecosystem. **Lost:** stateless agent loops and older heavyweight local coders.

**Sources:** [OpenAI: next Agents SDK](https://openai.com/index/the-next-evolution-of-the-agents-sdk/); [Qwen3.6-35B-A3B](https://qwen.ai/blog?id=qwen3.6-35b-a3b); [Qwen3.6-Max preview](https://qwen.ai/blog?id=qwen3.6-max-preview); [Qwen3.6-27B](https://qwen.ai/blog?id=qwen3.6-27b)

<!-- event: 2026-04-16; actors: Anthropic; tags: model,coding,vision -->
### April 16, 2026 — Claude Opus 4.7 adds self-verification and higher-resolution vision

**Development.** Anthropic upgraded its premium model. **Technical change.** Opus 4.7 improved long software projects, made self-checking more systematic, and accepted higher-resolution visual inputs for detailed computer and document work. **What it meant.** Reliability improvements increasingly came from verification behavior and perception quality, not context length alone. **Contemporary reaction.** Users valued fewer late-run failures; another quick flagship replacement reinforced release fatigue. **Power shift.** **Gained:** Anthropic’s high-value coding and visual workflows. **Lost:** Opus 4.6 and one-pass generation.

**Source:** [Anthropic: Claude Opus 4.7](https://www.anthropic.com/news/claude-opus-4-7)

<!-- event: 2026-04-20; actors: Moonshot AI,Kimi; tags: model,agents,open-weights -->
### April 20, 2026 — Kimi K2.6 scales open coding to hundreds of subagents

**Development.** Moonshot released Kimi K2.6 with open weights and a long-horizon coding system. **Technical change.** The system could coordinate as many as 300 subagents and thousands of steps, using parallel exploration and aggregation rather than one monolithic context. **What it meant.** Agent topology became as important as the base checkpoint, and an open lab demonstrated orchestration at frontier scale. **Contemporary reaction.** The scale was compelling but expensive; observers questioned how often hundreds of branches added value instead of duplicated work. **Power shift.** **Gained:** Moonshot and open multi-agent research. **Lost:** single-trajectory benchmark leaders.

**Source:** [Kimi: Kimi K2.6](https://www.kimi.com/en/blog/kimi-k2-6)

<!-- event: 2026-04-23; actors: OpenAI; tags: model,science,coding,agents -->
### April 23, 2026 — GPT-5.5 improves agentic coding, science, and token efficiency

**Development.** OpenAI released GPT-5.5 for professional work. **Technical change.** It improved long agent execution, coding, scientific reasoning, and tool reliability while using fewer tokens at roughly the same per-token latency as GPT-5.4. **What it meant.** Cost per completed task—not cost per token—became the more useful economic measure for frontier agents. **Contemporary reaction.** Professional users liked the lower total-token burden; critics saw another short-lived step before the announced 5.6 family. **Power shift.** **Gained:** OpenAI in science and complex execution. **Lost:** GPT-5.4 and verbose reasoning systems.

**Source:** [OpenAI: GPT-5.5](https://openai.com/index/introducing-gpt-5-5/)

<!-- event: 2026-05-15; actors: Cerebras; tags: company,capital,hardware -->
### May 15, 2026 — Cerebras completes a $6.4 billion IPO

**Development.** Cerebras completed an IPO of 34.5 million shares at $185, generating about $6.4 billion in gross proceeds, after its wafer-scale inference partnership with OpenAI. **Technical change.** The listing did not change the architecture, but supplied capital and public-market validation for wafer-scale training and inference systems. **What it meant.** Specialized AI hardware regained an independent financing route after years dominated by private capital and NVIDIA. **Contemporary reaction.** A successful debut validated demand; investors still focused on customer concentration, manufacturing dependence, and whether inference contracts would translate into durable margins. **Power shift.** **Gained:** Cerebras and public investors seeking a direct AI-compute alternative. **Lost:** the view that every challenger would be acquired before reaching scale.

**Sources:** [SEC: Cerebras closing Form 8-K](https://www.sec.gov/Archives/edgar/data/2021728/000162828026035605/closing8-k.htm); [Axios: Cerebras IPO](https://www.axios.com/2026/05/15/cerebras-ipo-success)

<!-- event: 2026-05-19; actors: Google; tags: model,inference,multimodal -->
### May 19, 2026 — Gemini 3.5 Flash makes multimodal agents cheaper

**Development.** Google released Gemini 3.5 Flash as the fast general-purpose member of its new generation. **Technical change.** The model improved coding, multimodal understanding, tool use, and token efficiency at a serving tier intended for high-volume agents. **What it meant.** Google used TPU/cloud integration to compete on useful work per dollar, not only the Pro model’s ceiling. **Contemporary reaction.** Developers welcomed the value tier; some waited for stable general availability before migrating production workloads. **Power shift.** **Gained:** Google’s volume inference and application developers. **Lost:** Gemini 3.1 Flash variants and expensive agent defaults.

**Source:** [Google: Gemini 3.5](https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-3-5/)

<!-- event: 2026-05-20; actors: Cohere; tags: model,open-weights,enterprise,coding -->
### May 20–June 9, 2026 — Cohere opens efficient multimodal and coding MoEs

**Development.** Cohere released Command A+ and North Mini Code under Apache 2.0. **Technical change.** Command A+ used 218B total/25B active parameters, 128K context, image input, reasoning, tools, and 48 languages while fitting quantized on one B200 or two H100s; North Mini Code used 30B total/3B active parameters with 256K input context for local agentic coding. **What it meant.** Cohere recast sovereign enterprise AI as a deployable open-weight stack, with a large workhorse and a small subagent rather than a single proprietary API. **Contemporary reaction.** Enterprise users welcomed the license and hardware efficiency; raw frontier comparisons remained secondary to privacy, multilingual retrieval, and total deployment cost. **Power shift.** **Gained:** Cohere, private-cloud buyers, and efficient open agents. **Lost:** Command A and closed enterprise models whose moat was merely on-premises availability.

**Sources:** [Cohere: Command A+](https://cohere.com/blog/command-a-plus); [Cohere release notes: North Mini Code](https://docs.cohere.com/v1/changelog)

<!-- event: 2026-05-22; actors: Mistral; tags: model,agents,coding,enterprise -->
### May 22–28, 2026 — Mistral Medium 3.5 powers remote Vibe agents and general work mode

**Development.** Mistral released Medium 3.5 inside remote coding agents and Le Chat Work mode, then expanded Vibe across long-horizon knowledge work and a VS Code extension. **Technical change.** Cloud agents preserved execution state away from a local terminal, while a unified model/harness handled code and general workplace artifacts with tool connections and human review. **What it meant.** Mistral followed Claude and Codex from a model API toward delegated work, but kept a European deployment and customization position. **Contemporary reaction.** The integrated workflow was a meaningful product step; buyers still weighed ecosystem maturity and model ceiling against larger rivals. **Power shift.** **Gained:** Mistral’s enterprise agent surface. **Lost:** local-only Vibe workflows and Mistral’s model-vendor-only identity.

**Source:** [Mistral: Medium 3.5 and remote Vibe agents](https://mistral.ai/news/vibe-remote-agents-mistral-medium-3-5/)

<!-- event: 2026-05-25; actors: xAI; tags: tooling,coding,agents -->
### May 25–June 15, 2026 — Grok Build turns xAI into a coding-agent platform

**Development.** xAI launched Grok Build in the terminal, followed by its Composer model/API and a plugin marketplace. **Technical change.** The harness managed repository edits, terminal work, model selection, subscriptions, and persistent skills; plugins connected the agent to outside tools. **What it meant.** xAI moved beyond model APIs and social chat into the same harness-and-ecosystem contest as Codex, Claude Code, Gemini CLI, and Cursor. **Contemporary reaction.** Existing X/Grok access made trial easy, but builders questioned maturity, safety, and whether the platform could catch established coding workflows. **Power shift.** **Gained:** xAI’s developer distribution. **Lost:** its image as only a consumer/social AI vendor.

**Sources:** [xAI: introducing Grok Build](https://x.ai/news/grok-build-cli); [xAI news index](https://x.ai/news)

<!-- event: 2026-05-28; actors: Anthropic; tags: model,agents,company,capital -->
### May 28, 2026 — Claude Opus 4.8 and a $65 billion round accelerate Anthropic

**Development.** Anthropic released Opus 4.8 and raised $65 billion at a $965 billion valuation. **Technical change.** The model added effort controls, dynamic workflow selection, and a fast mode reported at up to 2.5× normal speed, letting applications trade reasoning depth for latency. **What it meant.** Anthropic coupled a more economically steerable flagship with a balance sheet approaching the industry’s largest. **Contemporary reaction.** Coding and agent leadership supported the valuation; concentration, capital intensity, and rapid model succession remained major risks. **Power shift.** **Gained:** Anthropic’s model and financing position. **Lost:** Opus 4.7 and smaller frontier labs seeking the same institutional capital.

**Sources:** [Anthropic: Claude Opus 4.8](https://www.anthropic.com/news/claude-opus-4-8); [Anthropic: Series H](https://www.anthropic.com/news/series-h)

<!-- event: 2026-06-09; actors: Anthropic,US government; tags: model,cyber,regulation -->
### June 9–July 1, 2026 — Fable 5/Mythos 5 trigger a U.S. export-control interruption

**Development.** Anthropic released one core frontier model through two access regimes: safeguarded Fable 5 for general users and higher-capability Mythos 5 for trusted cyber defenders. On June 12, a U.S. government export-control action forced Anthropic to suspend both; access resumed July 1 after revised authorization. **Technical change.** Fable could fall back to Opus 4.8 when a request crossed capability boundaries, while Mythos exposed stronger cyber performance under identity, monitoring, and use restrictions. **What it meant.** Model variants, safety cases, and state licensing became one release mechanism; government action could interrupt even domestic access. **Contemporary reaction.** The incident alarmed customers and defenders while validating forecasts that frontier cyber models would be governed like dual-use technology. **Power shift.** **Gained:** U.S. export-control authority and vetted institutions. **Lost:** Anthropic’s release autonomy and customers’ confidence in uninterrupted access.

**Sources:** [Anthropic: Fable 5 and Mythos 5](https://www.anthropic.com/news/claude-fable-5-mythos-5); [access suspension](https://www.anthropic.com/news/fable-mythos-access); [redeployment](https://www.anthropic.com/news/redeploying-fable-5)

<!-- event: 2026-06-16; actors: Zhipu,GLM; tags: model,long-context,inference -->
### June 16, 2026 — GLM-5.2 makes one-million-token agents more computationally practical

**Development.** Zhipu released GLM-5.2. **Technical change.** A one-million-token context used IndexShare to reduce claimed per-token FLOPs about 2.9× at maximum length; multi-token prediction improved speculative-decoding acceptance, and effort levels exposed a latency/reasoning tradeoff. **What it meant.** The engineering problem shifted from merely accepting huge contexts to paying for and decoding them efficiently. **Contemporary reaction.** The systems innovations drew respect, though the longest-context and speed claims still required workload-specific validation. **Power shift.** **Gained:** Zhipu’s long-agent economics. **Lost:** brute-force full-attention serving and GLM-5.1.

**Source:** [Z.ai: GLM-5.2](https://z.ai/blog/glm-5.2)

<!-- event: 2026-06-26; actors: OpenAI,US government; tags: model,cyber,governance -->
### June 26, 2026 — OpenAI previews GPT-5.6 Sol under a phased safety regime

**Development.** OpenAI began a limited GPT-5.6 Sol preview and introduced the Sol, Terra, and Luna family structure plus an Ultra multi-agent mode. **Technical change.** Sol raised the single-agent frontier; Ultra allocated a task across multiple agents, while stronger cyber capability led OpenAI to coordinate phased access with government and trusted partners. **What it meant.** Intelligence became a portfolio of latency/cost tiers and a compute-scaling orchestration mode, not one model endpoint. **Contemporary reaction.** Performance and Ultra’s parallelism impressed, but access restrictions and cyber implications dominated the initial discussion. **Power shift.** **Gained:** OpenAI’s premium ceiling and government role in deployment. **Lost:** simple one-model product comparisons and unrestricted frontier access.

**Source:** [OpenAI: GPT-5.6 Sol limited preview](https://openai.com/index/previewing-gpt-5-6-sol/)

<!-- event: 2026-06-30; actors: Anthropic; tags: model,agents,coding -->
### June 30, 2026 — Claude Sonnet 5 moves next-generation agency to the volume tier

**Development.** Anthropic released Claude Sonnet 5 across consumer, coding, and API products. **Technical change.** It carried forward stronger long-horizon coding, computer use, tool planning, and context management at a lower price/latency point than Fable or Opus. **What it meant.** The commercially decisive frontier increasingly sat in the mid-tier model that could be deployed to every employee or subagent. **Contemporary reaction.** Enterprise users welcomed the cost/capability balance; premium models retained an edge on the hardest autonomous work. **Power shift.** **Gained:** Anthropic’s high-volume platform and subagent economics. **Lost:** Sonnet 4.6 and premium-only agent deployments.

**Source:** [Anthropic: Claude Sonnet 5](https://www.anthropic.com/news/claude-sonnet-5)

<!-- event: 2026-07-09; actors: OpenAI; tags: model,agents,product -->
### July 9–30, 2026 — GPT-5.6 becomes generally available and cheaper

**Development.** OpenAI broadly released GPT-5.6 Sol, Terra, Luna, and Ultra, then cut API prices later in July. **Technical change.** Sol served the highest-complexity single-agent work; Terra balanced quality and speed; Luna optimized high-throughput use; Ultra coordinated multiple agents and aggregated results. **What it meant.** Model routing became an explicit product architecture spanning cheap workers, a frontier reasoner, and parallel test-time compute. **Contemporary reaction.** Users praised coding and research capability but confronted a more complex model-selection problem; price cuts accelerated migration. **Power shift.** **Gained:** OpenAI’s coverage of the entire inference curve. **Lost:** GPT-5.5 and vendors differentiated only by one flagship.

**Source:** [OpenAI: GPT-5.6](https://openai.com/index/gpt-5-6/)

<!-- event: 2026-07-16; actors: Moonshot AI,Kimi,xAI; tags: model,open-weights,multimodal,coding -->
### July 16–27, 2026 — Kimi K3 reaches three-trillion-class open scale as Grok 4.5 advances coding

**Development.** Moonshot introduced Kimi K3 and released full weights on July 27; xAI released Grok 4.5 on July 16. **Technical change.** K3 used 2.8T total parameters with 16B active across 896 experts, a one-million-token window, native vision, Kimi Delta Attention, attention residuals, and Stable LatentMoE. Grok 4.5 improved coding, tool use, and knowledge work through closer training with its coding harness. **What it meant.** Open-weight scale crossed a new threshold while xAI demonstrated model/harness co-training. **Contemporary reaction.** K3’s launch overwhelmed Moonshot capacity and forced temporary subscription limits; independent observers saw it as frontier-class but still behind the strongest closed models on some tasks. **Power shift.** **Gained:** Moonshot’s global open-model standing and xAI’s coding credibility. **Lost:** smaller open-model hosts and older Grok/Kimi checkpoints.

**Sources:** [Kimi: Kimi K3](https://www.kimi.com/en/blog/kimi-k3); [Associated Press: Kimi K3 launch reaction](https://apnews.com/article/0d8a5e268deb11a673f4d444fc597cc5); [Associated Press: capacity overload](https://apnews.com/article/4c66a2e0f557ce79d3cc2d769c9a6226); [xAI: Grok 4.5](https://x.ai/news/grok-4-5)

<!-- event: 2026-07-21; actors: Google; tags: model,inference,cyber -->
### July 21, 2026 — Gemini 3.6 Flash and 3.5 derivatives segment speed, cost, and cyber access

**Development.** Google released Gemini 3.6 Flash, 3.5 Flash-Lite, and a restricted 3.5 Flash Cyber variant while confirming Gemini 4 pretraining. **Technical change.** 3.6 Flash improved token efficiency and agent quality; Flash-Lite targeted roughly 350 output tokens per second; Cyber integrated Google’s CodeMender defensive workflow under controlled access. **What it meant.** Google matched rivals with explicit fast, cheap, and gated dual-use tiers. **Contemporary reaction.** The inference speed and security specialization drew interest, while the large active catalog again raised lifecycle concerns. **Power shift.** **Gained:** Google Cloud, high-volume applications, and selected defenders. **Lost:** previous Gemini Flash tiers and undifferentiated security assistants.

**Source:** [Google: Gemini 3.6 Flash, 3.5 Flash-Lite, and Cyber](https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-3-6-flash-3-5-flash-lite-3-5-flash-cyber/)

<!-- event: 2026-07-24; actors: Anthropic; tags: model,agents,coding -->
### July 24, 2026 — Claude Opus 5 restores Anthropic’s unrestricted premium flagship

**Development.** Anthropic released Opus 5 for the hardest coding, research, computer-use, and multi-agent work. **Technical change.** It improved sustained execution, delegation, verification, and recovery across large contexts while keeping the general product below Mythos’s restricted cyber envelope. **What it meant.** Anthropic maintained separate mainstream, premium, and controlled-capability lanes. **Contemporary reaction.** The release reinforced Claude’s agent reputation; customers still had to weigh premium cost against Sonnet 5’s strong economics. **Power shift.** **Gained:** Anthropic’s premium enterprise and coding position. **Lost:** Opus 4.8 and Fable as the only post-4.x ceiling.

**Source:** [Anthropic: Claude Opus 5](https://www.anthropic.com/news/claude-opus-5)

<!-- event: 2026-07-27; actors: European Union; tags: regulation,governance,global-reaction -->
### July 27–August 2, 2026 — The EU simplifies the AI Act, then begins broader enforcement

**Development.** The EU’s AI Omnibus entered force on July 27, adjusting and delaying parts of the high-risk regime; on August 2 the Commission began enforcing the Act’s next phase, including new transparency requirements. **Technical change.** This was institutional rather than architectural: providers faced documentation, disclosure, risk-management, incident, and transparency duties, but revised timing reduced some immediate high-risk-system burden. **What it meant.** Europe moved from rulemaking into supervision while responding to industry complaints that implementation was too complex and slow. **Contemporary reaction.** Industry welcomed simplification and critics warned that delay weakened protections; other governments watched Europe’s enforcement choices as a practical template. **Power shift.** **Gained:** the European Commission and firms able to fund compliance. **Lost:** regulatory certainty for smaller deployers and advocates seeking the original timetable.

**Sources:** [European Commission: AI Omnibus enters force](https://digital-strategy.ec.europa.eu/en/news/ai-omnibus-enters-force); [Commission begins enforcing the next AI Act phase](https://digital-strategy.ec.europa.eu/en/news/commission-starts-enforcing-ai-act-rules-and-new-transparency-requirements-2-august); [EU AI Act Service Desk: enforcement timetable](https://ai-act-service-desk.ec.europa.eu/en/ai-act/faq/when-does-enforcement-start)

<!-- event: 2026-08-06; actors: AMD,Taalas,TSMC; tags: hardware,company,inference -->
### August 6, 2026 — AMD agrees to acquire Taalas

**Development.** AMD announced a definitive agreement to buy the specialized-inference startup, subject to closing conditions. **Technical change.** AMD planned to combine Taalas’s model-hardcoded dataflows with Instinct GPUs, EPYC CPUs, ROCm, and Helios rack-scale systems instead of treating the fixed-function chip as a stand-alone replacement. **What it meant.** The most credible GPU challengers were building heterogeneous portfolios for training, flexible inference, and ultra-specialized decode. **Contemporary reaction.** The deal validated Taalas’s thesis only six months after HC1’s reveal, while raising questions about product independence and how quickly designs could enter AMD’s roadmap. **Power shift.** **Gained:** AMD’s inference IP and Taalas’s access to scale. **Lost:** Taalas’s independence and NVIDIA’s comfort with a purely GPU-shaped AMD rival.

**Source:** [AMD: acquisition of Taalas](https://newsroom.amd.com/news/amd-acquires-taalas-ai-inference/)

<!-- event: 2026-08-06; actors: OpenAI; tags: model,product,inference -->
### August 6, 2026 — GPT-5.6 chat tuning and free Luna broaden the family’s reach

**Development.** OpenAI updated GPT-5.6 Sol’s ChatGPT behavior and expanded access to Luna. **Technical change.** The change tuned conversational style, instruction following, and routing rather than retraining the capability frontier; a fast inexpensive family member became available to more users. **What it meant.** Post-training behavior and access policy could materially change product reception without a new base-model generation. **Contemporary reaction.** Users who disliked the initial chat style welcomed the adjustment; others saw it as evidence that benchmark strength did not ensure a satisfying assistant. **Power shift.** **Gained:** OpenAI’s consumer retention and free-tier reach. **Lost:** the original Sol chat configuration and smaller free assistants.

**Source:** [OpenAI: improving GPT-5.6 Sol in ChatGPT](https://openai.com/index/improving-gpt-5-6-sol-in-chatgpt/)

<!-- event: 2026-08-10; actors: OpenAI,US government; tags: cyber,model,governance -->
### August 10, 2026 — GPT-5.6 Cyber expands the Daybreak trusted-access program

**Development.** OpenAI offered a cyber-specialized GPT-5.6 through its Daybreak program to selected red and blue teams. **Technical change.** The system supported longer vulnerability discovery, exploit validation, and defensive remediation trajectories with monitoring and restricted onboarding. **What it meant.** The frontier cyber product became a governed service category, parallel to Anthropic’s Mythos approach. **Contemporary reaction.** Security teams saw defensive leverage; access inequity, proliferation, and whether safeguards would survive wider deployment remained contentious. **Power shift.** **Gained:** approved defenders, OpenAI, and participating governments. **Lost:** universal API parity and organizations outside trusted programs.

**Source:** [OpenAI: expanding Daybreak](https://openai.com/index/expanding-daybreak-as-the-cyber-defense-window-narrows/)

<!-- event: 2026-08-12; actors: xAI,GitHub; tags: model,coding,agents -->
### August 12–14, 2026 — Grok 4.6 trains on interactive environments and enters GitHub Copilot

**Development.** xAI released Grok 4.6, followed by availability in GitHub Copilot. **Technical change.** Agentic reinforcement learning covered CAD, kernel work, web development, and other interactive environments; the model improved long tasks, visual/interactive coding, and tool use at lower API prices. **What it meant.** Frontier training data shifted from static code to environments with state, feedback, and non-text artifacts, while Copilot supplied immediate distribution. **Contemporary reaction.** Coding users welcomed a credible additional model choice; safety history and limited independent evaluation continued to shadow xAI releases. **Power shift.** **Gained:** xAI and multi-model Copilot. **Lost:** Grok 4.5 and closed coding platforms without distribution partners.

**Sources:** [xAI: Grok 4.6](https://x.ai/news/grok-4-6); [xAI: Grok 4.6 in GitHub Copilot](https://x.ai/news/grok-4-6-github-copilot)

<!-- event: 2026-08-13; actors: OpenAI,Cerebras; tags: model,inference,hardware -->
### August 13, 2026 — OpenAI previews GPT-5.6 Ultrafast at up to 750 tokens per second

**Development.** OpenAI previewed an Ultrafast serving mode for GPT-5.6 Sol on Cerebras. **Technical change.** The serving stack delivered a reported peak near 750 output tokens per second—about 14× the standard mode—while keeping the same model capability rather than substituting a smaller checkpoint. **What it meant.** Hardware could turn a frontier asynchronous agent into an interactive collaborator without changing its weights. **Contemporary reaction.** The responsiveness was viewed as a genuine interface change; preview access, cost, and vendor-reported peaks limited immediate conclusions about broad production economics. **Power shift.** **Gained:** Cerebras, OpenAI, and latency-sensitive applications. **Lost:** the assumption that frontier quality necessarily implied slow interaction.

**Source:** [OpenAI: GPT-5.6 Ultrafast](https://openai.com/index/previewing-ultrafast/)

<!-- event: 2026-08-21; actors: AI industry; tags: cutoff,synthesis -->
### August 21, 2026 — At the cutoff, the frontier is a system, not a checkpoint

**Development.** By this date, no single release defined leadership: the competitive object was a routed family of models, durable agent runtime, tools, memory, sandboxes, proprietary data, high-speed inference, and power/network/foundry capacity. **Technical change.** Parallel agents, compaction, effort controls, computer use, controlled cyber variants, million-token contexts, multimodal embeddings, and heterogeneous accelerators became composable layers. **What it meant.** Benchmark leadership could change weekly while distribution, cost per completed task, reliability, capital access, and governance determined durable advantage. **Contemporary reaction.** Excitement over useful autonomy coexisted with fatigue over model churn, security incidents, employment anxiety, energy constraints, and geopolitical fragmentation. **Power shift.** **Gained:** vertically integrated labs, cloud/foundry/network suppliers, trusted-access institutions, and open ecosystems with efficient worker models. **Lost:** stand-alone model vendors, thin orchestration wrappers, and organizations unable to secure compute, distribution, or regulatory capacity.

**Sources:** Synthesis of the dated record above; representative cutoff sources include [OpenAI: GPT-5.6](https://openai.com/index/gpt-5-6/), [Anthropic: Claude Opus 5](https://www.anthropic.com/news/claude-opus-5), [Google: Gemini 3.6 Flash family](https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-3-6-flash-3-5-flash-lite-3-5-flash-cyber/), [NVIDIA: Vera Rubin](https://nvidianews.nvidia.com/news/nvidia-vera-rubin-platform), and the [European Commission’s enforcement update](https://digital-strategy.ec.europa.eu/en/news/commission-starts-enforcing-ai-act-rules-and-new-transparency-requirements-2-august).

---

# Strategic balance at the cutoff

This table is a snapshot, not a permanent ranking. “Power” means the ability to set prices, interfaces, standards, access conditions, or the direction of the next investment cycle—not just winning a benchmark.

| Actor / bloc | Main source of power on August 21, 2026 | Main constraint | Direction at cutoff |
|---|---|---|---|
| **OpenAI** | Broad consumer/developer distribution; GPT-5.6 family; Codex and Responses agent runtime; extraordinary capital; Microsoft plus diversified compute | Capital intensity, product complexity, safety/government scrutiny, dependence on external infrastructure | **Strengthening**, especially across routed agents and low-latency inference |
| **Anthropic** | Claude’s coding/enterprise loyalty; Claude Code/Cowork; MCP influence; strong long-agent reliability; nearly trillion-dollar financing valuation | Premium cost, cloud/compute partners, controlled-capability politics, fewer mass-consumer channels | **Strengthening**, with the clearest premium-agent identity |
| **Google** | Search, Android, Workspace, Cloud, TPUs, DeepMind research, and Gemini distribution under one owner | Product/name churn, preview-to-production friction, antitrust exposure | **Strengthening**, because integration finally translated into coordinated releases |
| **SpaceXAI / xAI** | X real-time data and reach; Colossus compute; SpaceX capital, launch, and connectivity; faster Grok/coding cadence | Governance concentration, safety reputation, related-party risk, enterprise maturity | **Strengthening but volatile** |
| **Meta** | Llama installed base, consumer attention, open-weight legitimacy, and enormous infrastructure budget | Llama 4 launch disappointment, talent churn, tension between open distribution and monetization | **Mixed**: structurally powerful, less clearly at the model frontier |
| **Alibaba / Qwen** | The broadest high-quality open family across sizes/modalities; Alibaba Cloud; strong multilingual and coding distribution | U.S. controls, domestic price competition, split between open and proprietary flagships | **Strengthening globally**, especially as an ecosystem default |
| **Moonshot AI / Kimi** | Frontier-scale open checkpoints, long context, inventive parallel-agent systems, strong Chinese consumer brand | Serving capacity, capital relative to hyperscalers, monetizing global open adoption | **Rapidly strengthening** |
| **Zhipu / GLM** | Open large MoEs, agent RL, long-context efficiency, domestic-hardware credibility, Chinese enterprise/government ties | Crowded domestic market, difficult full-model serving, geopolitics | **Strengthening**, with sovereign-stack relevance |
| **DeepSeek** | Cost-efficient open reasoning, reproducible technical disclosures, pricing pressure on the entire industry | Service restrictions, political scrutiny, monetization and capacity | **Strategically strong** even when not leading every release cycle |
| **Mistral and smaller open players** | Efficient European/open alternatives, deployability, specialization, enterprise control | Capital and distribution gap versus hyperscalers; commoditization by Qwen/DeepSeek/Kimi | **Important but squeezed**; differentiation matters more than general benchmarks |
| **NVIDIA** | CUDA; complete rack-scale systems; NVLink/Spectrum networking; fastest product cadence; developer and OEM lock-in | Power and supply limits, custom ASICs, export controls, customer desire for bargaining leverage | **Still the central toll collector**, now defending inference as aggressively as training |
| **Broadcom** | Custom accelerators and Ethernet switching/optics for hyperscalers; scale-up and scale-out fabric expertise | Customer concentration; less visible software platform; dependence on foundry capacity | **Strengthening quietly** as AI factories become networks |
| **AMD** | Instinct/Helios, EPYC, ROCm improvements, open ecosystem positioning, and Taalas specialization | CUDA gap, execution against NVIDIA’s integrated rack cadence | **Strengthening as the broadest second source** |
| **Cerebras** | Wafer-scale latency/throughput; OpenAI contract; public-market capital | Customer concentration, delivery economics, TSMC/manufacturing dependence | **Strengthening**, with a validated real-time inference niche |
| **TSMC and advanced-packaging suppliers** | Near-irreplaceable leading-edge fabrication, CoWoS-class packaging, yield learning, and customer diversity | Geographic concentration, water/power, equipment bottlenecks, cross-strait risk | **Maximum structural leverage** with maximum geopolitical exposure |
| **United States and allies** | Export controls, frontier-lab jurisdiction, capital markets, cloud and semiconductor chokepoints | Controls can accelerate substitution; fragmented domestic privacy/safety rules | **More direct power over deployment**, but declining certainty that controls preserve a durable technical lead |
| **China** | Huge engineering base, domestic market, open-model momentum, state-backed compute substitution | Access to leading lithography, HBM, accelerators, and some global markets | **Gaining model-level leverage despite hardware constraints** |
| **European Union** | The first broad, enforceable cross-sector AI rulebook and a large regulated market | Limited frontier-lab/accelerator base; implementation complexity; competitiveness concerns | **Gaining supervisory power**, while trading speed against protection |

## Eight structural shifts across the period

1. **The product moved from model to system.** In 2021 the salient artifact was a checkpoint. By 2026 the useful unit was a routed model family plus tools, memory, retrieval, computer access, sandboxes, compaction, identity, review, and durable execution.

2. **Post-training became a primary frontier.** InstructGPT, RLHF, constitutional AI, direct preference methods, verifiable-reward RL, tool-use training, self-verification, and environment-based agent RL repeatedly changed usefulness without proportional changes in pretraining scale.

3. **Inference compute became adjustable.** Reasoning modes, effort controls, parallel branches, swarms, Heavy/Ultra tiers, and specialist subagents let products spend more compute after the prompt. “Model size” alone stopped describing delivered intelligence.

4. **Open weights became a geopolitical distribution channel.** Llama created the mass ecosystem; Mistral, Qwen, DeepSeek, GLM, and Kimi made it globally competitive. Open distribution spread capability and weakened API pricing power, even when training data and full recipes stayed closed.

5. **Coding was the bridge to general agency.** Copilot proved commercial demand; ReAct supplied a pattern; AutoGPT exposed failure modes; Cursor, Claude Code, Codex, Gemini CLI, Devin, and Grok Build turned repository and terminal work into a proving ground for planning, tools, verification, and long-run state.

6. **The AI chip became an AI factory.** H100 scarcity first privileged the accelerator. Blackwell/Rubin, Ultra Ethernet, NVLink, optics, custom ASICs, wafer-scale engines, and rack-level cooling shifted value toward the entire powered and networked system. TSMC and advanced packaging remained beneath nearly every path.

7. **Latency re-entered the capability equation.** Groq, Cerebras, Taalas, speculative decoding, sparse attention, and model tiers showed that a slightly weaker instant model—or the same frontier model served 10–14× faster—could enable a qualitatively different product.

8. **Governance moved inside the release architecture.** The EU AI Act, executive orders, export controls, safety institutes, frontier-safety laws, copyright cases, and restricted cyber variants affected who could train, access, document, or deploy a system. Policy was no longer an external afterthought.

# Website ingestion contract

Each timeline entry begins with a non-rendering HTML comment:

```html
<!-- event: YYYY-MM-DD; actors: Actor A,Actor B; tags: model,agents,hardware -->
```

Use that comment as the stable record header. The visible `###` heading supplies the display date and title; the six bold labels supply the body fields. A parser should retain Markdown links in `source_markdown` and separately extract their labels and URLs.

Suggested normalized event object:

```json
{
  "date_start": "2026-08-13",
  "display_date": "August 13, 2026",
  "title": "OpenAI previews GPT-5.6 Ultrafast at up to 750 tokens per second",
  "actors": ["OpenAI", "Cerebras"],
  "tags": ["model", "inference", "hardware"],
  "inflection": null,
  "development": "…",
  "technical_change": "…",
  "meaning": "…",
  "reaction": "…",
  "gained_power": ["Cerebras", "OpenAI", "latency-sensitive applications"],
  "lost_power": ["slow-frontier inference assumption"],
  "sources": [{"label": "OpenAI: GPT-5.6 Ultrafast", "url": "https://…"}]
}
```

Recommended filters are `year`, `actor`, `tag`, and `inflection`. Set `inflection` to `"felt"` when the metadata includes the `inflection-point` tag; otherwise use `null`. Recommended saved views are **Inflection points**, **Models**, **Agents & tooling**, **Hardware & networking**, **Corporate power**, and **Regulation & courts**. Where a heading spans multiple dates, `event:` records the first date and the heading preserves the full public sequence.

# Editorial and source notes

- **Selection rule.** “Significant” means a public model/variant, tool, transaction, hardware milestone, or government action that materially changed capability, cost, distribution, access, standards, or strategic leverage. Silent snapshot changes, routine regional availability, and inconsequential patch versions are omitted or grouped.
- **Date rule.** Dates are announcement or public-availability dates, not undocumented training completion dates. Month-only events retain month precision in their metadata.
- **Evidence rule.** Technical specifications and release dates prefer first-party model cards, papers, official blogs, filings, courts, and regulators. Independent reporting is used where contemporary reaction, contested facts, or transaction context requires it.
- **Claim rule.** Vendor benchmark, token-speed, parameter, power, and cost claims are not treated as independently audited merely because they appear in an official source. Entries explicitly qualify the most decision-relevant claims.
- **Reaction rule.** “Contemporary reaction” is a concise synthesis of documented public, developer, investor, policy, or customer response at that time. It is not a public-opinion poll.
- **Link durability.** For a published website, archive the cited pages and store retrieval dates. Corporate URLs and release-note indexes can move even when the underlying event does not.
- **Cutoff discipline.** The record stops at **August 21, 2026, 11:59 p.m. America/New_York**. Later knowledge should be added as a new version rather than silently backfilled into this one.

*Version 1.1 · Research cutoff August 21, 2026 · 224 dated entries · 2 felt inflection points*
