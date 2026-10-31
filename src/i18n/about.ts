// About / CV page copy per language. Logos, skills and percentages live in about.astro.
const en = {
  title: 'About | Aymane Elamrani',
  photoAlt: 'Aymane in Cadaqués',
  label: 'About me',
  heading: "Hey, I'm",
  bio: [
    "Quantitative Data Scientist and ML Engineer with a double degree in Computer Science and Business, plus a master's in Quantum Information & Photonics from UPV Valencia. I've built ETL pipelines and dashboards at Amazon, won a pan-European data science challenge with Oliver Wyman, and done physics-informed ML research in optical imaging.",
    "Now I'm carving my way into quantitative finance and agentic AI, applying the same mathematical rigor to markets and autonomous systems. I like hard problems, messy data, and first-principles thinking.",
  ],
  help: 'How can I help you?',
  experienceHeading: 'Experience',
  experience: [
    {
      role: 'Research Intern',
      period: 'Mar 2026 - Sep 2026',
      bullets: [
        'Designed and validated an optical simulation (FDTD + Mie theory): virtual test bench definition and experimental result interpretation.',
        'Built a Python pipeline for synthetic data generation and signal acquisition to train inverse models at scale.',
        'Used Docker to isolate execution environments and test model versions in parallel; Git-based version control in a shared repository.',
      ],
    },
    {
      role: 'Strategy Consultant / Data Science',
      period: 'Feb 2025 - May 2025',
      bullets: [
        'Built a churn prediction model (XGBoost + logistic regression) achieving 80% precision and recall.',
        'Designed a data-driven retention strategy (€35k budget, 91.8% ROI).',
        'Winner of a selective pan-European challenge, first place against teams from top EU universities.',
      ],
    },
    {
      role: 'Business Intelligence Engineer, Intern',
      period: 'Aug 2023 - Feb 2024',
      bullets: [
        'Built end-to-end ETL pipelines (Python, SQL, Amazon Redshift) to integrate and process logistics data at European scale.',
        'Developed real-time executive dashboards (Amazon QuickSight) to monitor transport KPIs, capacity, and route performance.',
        'Automated weekly logistics planning with Python scripts, achieving 98% scheduling accuracy and eliminating €500k in annual operational waste.',
      ],
    },
    {
      role: 'Data Manager',
      period: 'Jul 2022 - Sep 2022',
      bullets: [
        'Managed the migration of legacy ETL processes to SAP, ensuring data integrity across systems.',
        'Coordinated data flows between departments during the transition period.',
      ],
    },
  ],
  educationHeading: 'Education',
  gradeLabel: 'Grade',
  education: [
    {
      degree: 'MSc in Quantum Information & Photonics',
      period: 'Sep 2025 - 2026',
      grade: '8/10',
      detail: 'Thesis: Physics-Informed Deep Learning for Quantitative Reconstruction in OCT',
    },
    {
      degree: 'Double BSc in Computer Science & Business Management',
      period: 'Sep 2019 - Jul 2025',
      grade: '9.9/10, Highest Honors',
      detail: 'Theses: Real-Time Sign Language to Speech Translation; Amazon Elderly data-driven marketing strategy (8.5/10)',
    },
  ],
  skillsHeading: 'Technical Skills',
  skillLabels: ['Languages', 'ML / AI', 'Backend', 'Frontend', 'Data & BI', 'DevOps'],
  languagesHeading: 'Languages',
  languages: [
    { name: 'Arabic', level: 'Native' },
    { name: 'French', level: 'C1' },
    { name: 'Spanish', level: 'Bilingual' },
    { name: 'English', level: 'C1/C2' },
  ],
  interestsHeading: 'Interests',
  interests: [
    { title: 'Agentic AI', text: 'Multi-agent systems, tool-calling architectures, and the future of autonomous software.' },
    { title: 'Quantitative Finance', text: 'Portfolio optimization, Monte Carlo methods, and algorithmic approaches to markets.' },
    { title: 'Scientific Computing', text: 'Physics-informed neural nets, numerical simulation, and computational methods.' },
    { title: 'Automation', text: 'Workflow automation with n8n, scripting repetitive tasks, and building personal infrastructure.' },
  ],
  ctaTitle: "Let's connect",
  ctaDesc: "Want to collaborate on a project, chat about AI, or just say hello? I'm always happy to hear from interesting people.",
  ctaButton: 'Get in touch →',
};

type AboutCopy = typeof en;

const es: AboutCopy = {
  title: 'Sobre mí | Aymane Elamrani',
  photoAlt: 'Aymane en Cadaqués',
  label: 'Sobre mí',
  heading: 'Hola, soy',
  bio: [
    'Científico de datos cuantitativo e ingeniero de ML con doble grado en Ingeniería Informática y ADE, y un máster en Información Cuántica y Fotónica por la UPV de Valencia. He construido pipelines ETL y dashboards en Amazon, ganado un reto paneuropeo de ciencia de datos con Oliver Wyman e investigado en ML informado por la física aplicado a imagen óptica.',
    'Ahora me abro camino en las finanzas cuantitativas y la IA agéntica, aplicando el mismo rigor matemático a los mercados y a los sistemas autónomos. Me gustan los problemas difíciles, los datos desordenados y pensar desde primeros principios.',
  ],
  help: '¿Cómo puedo ayudarte?',
  experienceHeading: 'Experiencia',
  experience: [
    {
      role: 'Investigador en prácticas',
      period: 'mar 2026 - sep 2026',
      bullets: [
        'Diseñé y validé una simulación óptica (FDTD + teoría de Mie): definición del banco de pruebas virtual e interpretación de resultados experimentales.',
        'Desarrollé un pipeline en Python para generar datos sintéticos y adquirir señales con los que entrenar modelos inversos a escala.',
        'Usé Docker para aislar entornos de ejecución y probar versiones de modelos en paralelo; control de versiones con Git en un repositorio compartido.',
      ],
    },
    {
      role: 'Consultor de estrategia / Data Science',
      period: 'feb 2025 - may 2025',
      bullets: [
        'Construí un modelo de predicción de abandono (XGBoost + regresión logística) con un 80 % de precisión y recall.',
        'Diseñé una estrategia de retención basada en datos (presupuesto de 35 k€, ROI del 91,8 %).',
        'Ganador de un reto paneuropeo selectivo: primer puesto frente a equipos de las mejores universidades europeas.',
      ],
    },
    {
      role: 'Business Intelligence Engineer, prácticas',
      period: 'ago 2023 - feb 2024',
      bullets: [
        'Construí pipelines ETL de extremo a extremo (Python, SQL, Amazon Redshift) para integrar y procesar datos logísticos a escala europea.',
        'Desarrollé dashboards ejecutivos en tiempo real (Amazon QuickSight) para seguir KPI de transporte, capacidad y rendimiento de rutas.',
        'Automaticé la planificación logística semanal con scripts de Python, logrando un 98 % de precisión en la planificación y eliminando 500 k€ anuales de despilfarro operativo.',
      ],
    },
    {
      role: 'Data Manager',
      period: 'jul 2022 - sep 2022',
      bullets: [
        'Gestioné la migración de procesos ETL heredados a SAP, garantizando la integridad de los datos entre sistemas.',
        'Coordiné los flujos de datos entre departamentos durante la transición.',
      ],
    },
  ],
  educationHeading: 'Formación',
  gradeLabel: 'Nota',
  education: [
    {
      degree: 'Máster en Información Cuántica y Fotónica',
      period: 'sep 2025 - 2026',
      grade: '8/10',
      detail: 'TFM: Deep learning informado por la física para la reconstrucción cuantitativa en OCT',
    },
    {
      degree: 'Doble grado en Ingeniería Informática y ADE',
      period: 'sep 2019 - jul 2025',
      grade: '9,9/10, Matrícula de Honor',
      detail: 'TFG: Traducción de lengua de signos a voz en tiempo real; estrategia de marketing basada en datos para Amazon Elderly (8,5/10)',
    },
  ],
  skillsHeading: 'Habilidades técnicas',
  skillLabels: ['Lenguajes', 'ML / IA', 'Backend', 'Frontend', 'Datos y BI', 'DevOps'],
  languagesHeading: 'Idiomas',
  languages: [
    { name: 'Árabe', level: 'Nativo' },
    { name: 'Francés', level: 'C1' },
    { name: 'Español', level: 'Bilingüe' },
    { name: 'Inglés', level: 'C1/C2' },
  ],
  interestsHeading: 'Intereses',
  interests: [
    { title: 'IA agéntica', text: 'Sistemas multiagente, arquitecturas con llamadas a herramientas y el futuro del software autónomo.' },
    { title: 'Finanzas cuantitativas', text: 'Optimización de carteras, métodos de Monte Carlo y enfoques algorítmicos de los mercados.' },
    { title: 'Computación científica', text: 'Redes neuronales informadas por la física, simulación numérica y métodos computacionales.' },
    { title: 'Automatización', text: 'Automatización de flujos con n8n, scripts para tareas repetitivas e infraestructura personal.' },
  ],
  ctaTitle: 'Hablemos',
  ctaDesc: '¿Quieres colaborar en un proyecto, charlar sobre IA o simplemente saludar? Siempre me alegra conocer a gente interesante.',
  ctaButton: 'Contactar →',
};

const fr: AboutCopy = {
  title: 'À propos | Aymane Elamrani',
  photoAlt: 'Aymane à Cadaqués',
  label: 'À propos',
  heading: 'Salut, je suis',
  bio: [
    "Data scientist quantitatif et ingénieur ML, avec un double diplôme en informatique et en gestion d'entreprise, et un master en information quantique et photonique de l'UPV de Valence. J'ai construit des pipelines ETL et des tableaux de bord chez Amazon, remporté un challenge paneuropéen de data science avec Oliver Wyman et mené des recherches en ML informé par la physique appliqué à l'imagerie optique.",
    "Je me lance maintenant dans la finance quantitative et l'IA agentique, en appliquant la même rigueur mathématique aux marchés et aux systèmes autonomes. J'aime les problèmes difficiles, les données désordonnées et le raisonnement par principes premiers.",
  ],
  help: 'Comment puis-je vous aider ?',
  experienceHeading: 'Expérience',
  experience: [
    {
      role: 'Stagiaire de recherche',
      period: 'mars 2026 - sept. 2026',
      bullets: [
        "Conception et validation d'une simulation optique (FDTD + théorie de Mie) : définition du banc d'essai virtuel et interprétation des résultats expérimentaux.",
        "Développement d'un pipeline Python de génération de données synthétiques et d'acquisition de signaux pour entraîner des modèles inverses à grande échelle.",
        "Utilisation de Docker pour isoler les environnements d'exécution et tester des versions de modèles en parallèle ; gestion de versions avec Git dans un dépôt partagé.",
      ],
    },
    {
      role: 'Consultant en stratégie / Data Science',
      period: 'févr. 2025 - mai 2025',
      bullets: [
        "Création d'un modèle de prédiction du churn (XGBoost + régression logistique) atteignant 80 % de précision et de rappel.",
        "Conception d'une stratégie de rétention fondée sur les données (budget de 35 k€, ROI de 91,8 %).",
        'Vainqueur d\'un challenge paneuropéen sélectif : première place face aux équipes des meilleures universités européennes.',
      ],
    },
    {
      role: 'Business Intelligence Engineer, stage',
      period: 'août 2023 - févr. 2024',
      bullets: [
        'Construction de pipelines ETL de bout en bout (Python, SQL, Amazon Redshift) pour intégrer et traiter des données logistiques à l\'échelle européenne.',
        'Développement de tableaux de bord de direction en temps réel (Amazon QuickSight) pour suivre les KPI de transport, la capacité et la performance des itinéraires.',
        'Automatisation de la planification logistique hebdomadaire avec des scripts Python : 98 % de précision de planification et 500 k€ de gaspillage opérationnel annuel éliminés.',
      ],
    },
    {
      role: 'Data Manager',
      period: 'juil. 2022 - sept. 2022',
      bullets: [
        "Pilotage de la migration des processus ETL historiques vers SAP, en garantissant l'intégrité des données entre les systèmes.",
        'Coordination des flux de données entre les services pendant la période de transition.',
      ],
    },
  ],
  educationHeading: 'Formation',
  gradeLabel: 'Note',
  education: [
    {
      degree: 'Master en information quantique et photonique',
      period: 'sept. 2025 - 2026',
      grade: '8/10',
      detail: 'Mémoire : deep learning informé par la physique pour la reconstruction quantitative en OCT',
    },
    {
      degree: "Double licence en informatique et gestion d'entreprise",
      period: 'sept. 2019 - juil. 2025',
      grade: '9,9/10, mention très honorable',
      detail: 'Mémoires : traduction en temps réel de la langue des signes vers la parole ; stratégie marketing fondée sur les données pour Amazon Elderly (8,5/10)',
    },
  ],
  skillsHeading: 'Compétences techniques',
  skillLabels: ['Langages', 'ML / IA', 'Backend', 'Frontend', 'Données et BI', 'DevOps'],
  languagesHeading: 'Langues',
  languages: [
    { name: 'Arabe', level: 'Langue maternelle' },
    { name: 'Français', level: 'C1' },
    { name: 'Espagnol', level: 'Bilingue' },
    { name: 'Anglais', level: 'C1/C2' },
  ],
  interestsHeading: "Centres d'intérêt",
  interests: [
    { title: 'IA agentique', text: "Systèmes multi-agents, architectures d'appel d'outils et avenir des logiciels autonomes." },
    { title: 'Finance quantitative', text: 'Optimisation de portefeuille, méthodes de Monte Carlo et approches algorithmiques des marchés.' },
    { title: 'Calcul scientifique', text: 'Réseaux de neurones informés par la physique, simulation numérique et méthodes de calcul.' },
    { title: 'Automatisation', text: "Automatisation de workflows avec n8n, scripts pour les tâches répétitives et infrastructure personnelle." },
  ],
  ctaTitle: 'Échangeons',
  ctaDesc: "Envie de collaborer sur un projet, de parler d'IA ou simplement de dire bonjour ? J'aime toujours rencontrer des gens intéressants.",
  ctaButton: 'Me contacter →',
};

export const about = { en, es, fr };
