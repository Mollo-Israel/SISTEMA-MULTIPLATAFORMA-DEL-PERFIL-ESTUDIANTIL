/**
 * Lectura determinista de manifiestos (V3 §24.3).
 *
 * Solo ficheros controlados, solo su texto, y reglas fijas: dependencia →
 * tecnología candidata. No se clona, no se instala ni se ejecuta nada del
 * repositorio (§25). `dependencia presente ≠ dominio profesional`: esto
 * corrobora que la tecnología está en el proyecto, nada más.
 */

/** Ficheros que se leen (§24.3). Los demás no se tocan. */
export const MANIFEST_FILES = [
  'package.json',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'requirements.txt',
  'pyproject.toml',
  'pom.xml',
  'build.gradle',
  'Dockerfile',
  'docker-compose.yml',
  'docker-compose.yaml',
  'compose.yml',
] as const;

/** Tope de tamaño por fichero: un manifiesto real cabe de sobra. */
export const MAX_MANIFEST_BYTES = 1_000_000;

export interface DependencySignal {
  /** Tecnología candidata, con el nombre del catálogo. */
  technology: string;
  /** Fichero donde apareció. */
  file: string;
  /** Qué la delató: el paquete, la imagen o la instrucción. */
  evidence: string;
}

/** Paquete npm → tecnología. */
const NPM: Record<string, string> = {
  react: 'React',
  'react-dom': 'React',
  'react-native': 'React Native',
  expo: 'Expo',
  next: 'Next.js',
  vue: 'Vue.js',
  nuxt: 'Nuxt',
  '@angular/core': 'Angular',
  svelte: 'Svelte',
  '@nestjs/core': 'NestJS',
  express: 'Express',
  fastify: 'Fastify',
  typescript: 'TypeScript',
  pg: 'PostgreSQL',
  'pg-promise': 'PostgreSQL',
  mysql: 'MySQL',
  mysql2: 'MySQL',
  mongoose: 'MongoDB',
  mongodb: 'MongoDB',
  redis: 'Redis',
  ioredis: 'Redis',
  typeorm: 'TypeORM',
  prisma: 'Prisma',
  '@prisma/client': 'Prisma',
  sequelize: 'Sequelize',
  jest: 'Jest',
  vitest: 'Vitest',
  cypress: 'Cypress',
  '@playwright/test': 'Playwright',
  tailwindcss: 'Tailwind CSS',
  bootstrap: 'Bootstrap',
  'socket.io': 'Socket.IO',
  graphql: 'GraphQL',
  vite: 'Vite',
  electron: 'Electron',
  firebase: 'Firebase',
  'firebase-admin': 'Firebase',
  '@tensorflow/tfjs': 'TensorFlow',
  'three': 'Three.js',
  'chart.js': 'Chart.js',
  d3: 'D3.js',
};

/** Paquete Python → tecnología. */
const PYPI: Record<string, string> = {
  django: 'Django',
  flask: 'Flask',
  fastapi: 'FastAPI',
  pandas: 'Pandas',
  numpy: 'NumPy',
  'scikit-learn': 'Scikit-learn',
  sklearn: 'Scikit-learn',
  tensorflow: 'TensorFlow',
  torch: 'PyTorch',
  keras: 'Keras',
  'opencv-python': 'OpenCV',
  matplotlib: 'Matplotlib',
  psycopg2: 'PostgreSQL',
  'psycopg2-binary': 'PostgreSQL',
  psycopg: 'PostgreSQL',
  pymysql: 'MySQL',
  'mysqlclient': 'MySQL',
  pymongo: 'MongoDB',
  redis: 'Redis',
  sqlalchemy: 'SQLAlchemy',
  pytest: 'Pytest',
  celery: 'Celery',
  streamlit: 'Streamlit',
};

/** Fragmento de artefacto Maven/Gradle → tecnología. */
const JVM: [RegExp, string][] = [
  [/spring-boot/i, 'Spring Boot'],
  [/hibernate/i, 'Hibernate'],
  [/junit/i, 'JUnit'],
  [/org\.postgresql|postgresql/i, 'PostgreSQL'],
  [/mysql-connector/i, 'MySQL'],
  [/kotlin/i, 'Kotlin'],
];

/** Imagen de docker-compose → tecnología. */
const IMAGES: [RegExp, string][] = [
  [/^postgres(:|$)|postgis/i, 'PostgreSQL'],
  [/^mysql(:|$)/i, 'MySQL'],
  [/^mariadb(:|$)/i, 'MariaDB'],
  [/^mongo(:|$)/i, 'MongoDB'],
  [/^redis(:|$)/i, 'Redis'],
  [/^nginx(:|$)/i, 'Nginx'],
  [/^rabbitmq(:|$)/i, 'RabbitMQ'],
  [/^(bitnami\/)?kafka(:|$)|confluentinc\/cp-kafka/i, 'Kafka'],
  [/^elasticsearch|elastic\/elasticsearch/i, 'Elasticsearch'],
];

/** Imagen base de un Dockerfile → tecnología. */
const BASE_IMAGES: [RegExp, string][] = [
  [/^node(:|$)/i, 'Node.js'],
  [/^python(:|$)/i, 'Python'],
  [/^(eclipse-temurin|openjdk|amazoncorretto)(:|$)/i, 'Java'],
  [/^golang(:|$)/i, 'Go'],
  [/^php(:|$)/i, 'PHP'],
  [/^nginx(:|$)/i, 'Nginx'],
];

function agregar(out: DependencySignal[], technology: string, file: string, evidence: string): void {
  if (!out.some((s) => s.technology === technology && s.file === file)) {
    out.push({ technology, file, evidence });
  }
}

function deNpm(nombres: Iterable<string>, file: string, out: DependencySignal[]): void {
  for (const n of nombres) {
    const t = NPM[n.toLowerCase()];
    if (t) agregar(out, t, file, n);
  }
}

/** Nombre normalizado de un requisito Python (`Django>=4 ; python_version>"3"` → `django`). */
function paquetePython(linea: string): string | null {
  const limpio = linea.split('#')[0].trim();
  if (!limpio || limpio.startsWith('-')) return null;
  const m = /^([A-Za-z0-9_.-]+)/.exec(limpio);
  return m ? m[1].toLowerCase().replace(/_/g, '-') : null;
}

/**
 * Señales de un manifiesto. Nunca lanza: un fichero ilegible no aporta
 * nada, pero tampoco acusa a nadie (§29).
 */
export function signalsFromManifest(file: string, text: string): DependencySignal[] {
  const out: DependencySignal[] = [];
  const nombre = file.toLowerCase();
  try {
    if (nombre === 'package.json') {
      const pkg = JSON.parse(text);
      deNpm(Object.keys({ ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}), ...(pkg.peerDependencies ?? {}) }), file, out);
      agregar(out, 'Node.js', file, 'package.json');
      agregar(out, 'JavaScript', file, 'package.json');
    } else if (nombre === 'package-lock.json') {
      // Solo las dependencias directas del proyecto (raíz), no las transitivas.
      const lock = JSON.parse(text);
      const raiz = lock.packages?.[''] ?? {};
      deNpm(Object.keys({ ...(raiz.dependencies ?? {}), ...(raiz.devDependencies ?? {}), ...(lock.dependencies && !lock.packages ? lock.dependencies : {}) }), file, out);
    } else if (nombre === 'pnpm-lock.yaml') {
      // Bloque `importers: .:` → dependencias directas de la raíz.
      const bloque = /importers:\s*\n\s+\.:\s*\n([\s\S]*?)(?:\n\S|\n {2}\S)/.exec(text)?.[1] ?? '';
      const directas = [...bloque.matchAll(/^\s{6}'?(@?[A-Za-z0-9_.\/-]+)'?:\s*$/gm)].map((m) => m[1]);
      deNpm(directas, file, out);
    } else if (nombre === 'yarn.lock') {
      // Sin información de cuáles son directas: solo se reconoce el gestor.
      agregar(out, 'Yarn', file, 'yarn.lock');
    } else if (nombre === 'requirements.txt') {
      for (const linea of text.split(/\r?\n/)) {
        const p = paquetePython(linea);
        if (p && PYPI[p]) agregar(out, PYPI[p], file, p);
      }
      agregar(out, 'Python', file, 'requirements.txt');
    } else if (nombre === 'pyproject.toml') {
      const deps = [...text.matchAll(/["']([A-Za-z0-9_.-]+)\s*(?:[<>=!~^ ;\[].*?)?["']/g)].map((m) => m[1].toLowerCase());
      const poetry = [...text.matchAll(/^([A-Za-z0-9_.-]+)\s*=\s*["{]/gm)].map((m) => m[1].toLowerCase());
      for (const p of [...deps, ...poetry]) {
        const clave = p.replace(/_/g, '-');
        if (PYPI[clave]) agregar(out, PYPI[clave], file, p);
      }
      agregar(out, 'Python', file, 'pyproject.toml');
    } else if (nombre === 'pom.xml' || nombre === 'build.gradle') {
      for (const [re, t] of JVM) if (re.test(text)) agregar(out, t, file, re.source);
      agregar(out, 'Java', file, nombre);
      agregar(out, nombre === 'pom.xml' ? 'Maven' : 'Gradle', file, nombre);
    } else if (nombre === 'dockerfile') {
      for (const m of text.matchAll(/^\s*FROM\s+(?:--platform=\S+\s+)?(\S+)/gim)) {
        for (const [re, t] of BASE_IMAGES) if (re.test(m[1])) agregar(out, t, file, `FROM ${m[1]}`);
      }
      agregar(out, 'Docker', file, 'Dockerfile');
    } else if (/^(docker-)?compose\.ya?ml$/.test(nombre)) {
      for (const m of text.matchAll(/^\s*image:\s*["']?([^\s"']+)/gim)) {
        for (const [re, t] of IMAGES) if (re.test(m[1])) agregar(out, t, file, `image: ${m[1]}`);
      }
      agregar(out, 'Docker', file, nombre);
    }
  } catch {
    // Manifiesto mal formado: no aporta señales.
  }
  return out;
}
