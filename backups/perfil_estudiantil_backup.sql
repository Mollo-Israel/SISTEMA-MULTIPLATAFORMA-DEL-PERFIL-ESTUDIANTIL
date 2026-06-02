--
-- PostgreSQL database dump
--

\restrict JBmDbjnO4fk0Zzm8C6cGFXUBgmmwKobHYshnjqz3V3ikR8UpXuUVazfsC2biGu2

-- Dumped from database version 16.14
-- Dumped by pg_dump version 16.14

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: activities_category_enum; Type: TYPE; Schema: public; Owner: perfil_user
--

CREATE TYPE public.activities_category_enum AS ENUM (
    'taller_academico',
    'clase_espejo',
    'seminario',
    'charla',
    'curso_externo_recomendado',
    'reto',
    'hackathon',
    'convocatoria',
    'actividad_sociedad_cientifica',
    'club_estudio',
    'tutoria',
    'investigacion',
    'responsabilidad_social',
    'integracion'
);


ALTER TYPE public.activities_category_enum OWNER TO perfil_user;

--
-- Name: activities_modality_enum; Type: TYPE; Schema: public; Owner: perfil_user
--

CREATE TYPE public.activities_modality_enum AS ENUM (
    'presencial',
    'virtual',
    'hibrida'
);


ALTER TYPE public.activities_modality_enum OWNER TO perfil_user;

--
-- Name: activities_status_enum; Type: TYPE; Schema: public; Owner: perfil_user
--

CREATE TYPE public.activities_status_enum AS ENUM (
    'draft',
    'published',
    'open',
    'closed',
    'finished',
    'cancelled'
);


ALTER TYPE public.activities_status_enum OWNER TO perfil_user;

--
-- Name: activities_type_enum; Type: TYPE; Schema: public; Owner: perfil_user
--

CREATE TYPE public.activities_type_enum AS ENUM (
    'academica',
    'extracurricular'
);


ALTER TYPE public.activities_type_enum OWNER TO perfil_user;

--
-- Name: activity_registrations_status_enum; Type: TYPE; Schema: public; Owner: perfil_user
--

CREATE TYPE public.activity_registrations_status_enum AS ENUM (
    'interested',
    'registered',
    'confirmed',
    'absent'
);


ALTER TYPE public.activity_registrations_status_enum OWNER TO perfil_user;

--
-- Name: affinity_results_level_enum; Type: TYPE; Schema: public; Owner: perfil_user
--

CREATE TYPE public.affinity_results_level_enum AS ENUM (
    'low',
    'medium',
    'high'
);


ALTER TYPE public.affinity_results_level_enum OWNER TO perfil_user;

--
-- Name: internal_constancies_status_enum; Type: TYPE; Schema: public; Owner: perfil_user
--

CREATE TYPE public.internal_constancies_status_enum AS ENUM (
    'pending',
    'authorized',
    'rejected'
);


ALTER TYPE public.internal_constancies_status_enum OWNER TO perfil_user;

--
-- Name: project_evidences_evidence_type_enum; Type: TYPE; Schema: public; Owner: perfil_user
--

CREATE TYPE public.project_evidences_evidence_type_enum AS ENUM (
    'link',
    'file'
);


ALTER TYPE public.project_evidences_evidence_type_enum OWNER TO perfil_user;

--
-- Name: projects_status_enum; Type: TYPE; Schema: public; Owner: perfil_user
--

CREATE TYPE public.projects_status_enum AS ENUM (
    'draft',
    'active',
    'archived'
);


ALTER TYPE public.projects_status_enum OWNER TO perfil_user;

--
-- Name: roles_name_enum; Type: TYPE; Schema: public; Owner: perfil_user
--

CREATE TYPE public.roles_name_enum AS ENUM (
    'STUDENT',
    'TEACHER',
    'CAREER_DIRECTOR',
    'SCIENTIFIC_SOCIETY',
    'ADMIN'
);


ALTER TYPE public.roles_name_enum OWNER TO perfil_user;

--
-- Name: student_profiles_status_enum; Type: TYPE; Schema: public; Owner: perfil_user
--

CREATE TYPE public.student_profiles_status_enum AS ENUM (
    'incomplete',
    'active',
    'updated'
);


ALTER TYPE public.student_profiles_status_enum OWNER TO perfil_user;

--
-- Name: users_status_enum; Type: TYPE; Schema: public; Owner: perfil_user
--

CREATE TYPE public.users_status_enum AS ENUM (
    'active',
    'inactive'
);


ALTER TYPE public.users_status_enum OWNER TO perfil_user;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: academic_areas; Type: TABLE; Schema: public; Owner: perfil_user
--

CREATE TABLE public.academic_areas (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(120) NOT NULL,
    description character varying(255),
    tags text[],
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.academic_areas OWNER TO perfil_user;

--
-- Name: activities; Type: TABLE; Schema: public; Owner: perfil_user
--

CREATE TABLE public.activities (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    title character varying(160) NOT NULL,
    description text,
    type public.activities_type_enum NOT NULL,
    modality public.activities_modality_enum DEFAULT 'presencial'::public.activities_modality_enum NOT NULL,
    academic_area_id uuid,
    creator_id uuid NOT NULL,
    event_date timestamp with time zone,
    capacity integer,
    status public.activities_status_enum DEFAULT 'draft'::public.activities_status_enum NOT NULL,
    tags text[],
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    category public.activities_category_enum NOT NULL,
    location character varying(200),
    external_url character varying(500),
    evidence_required boolean DEFAULT false NOT NULL
);


ALTER TABLE public.activities OWNER TO perfil_user;

--
-- Name: activity_registrations; Type: TABLE; Schema: public; Owner: perfil_user
--

CREATE TABLE public.activity_registrations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    activity_id uuid NOT NULL,
    student_profile_id uuid NOT NULL,
    status public.activity_registrations_status_enum DEFAULT 'interested'::public.activity_registrations_status_enum NOT NULL,
    confirmed_by uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.activity_registrations OWNER TO perfil_user;

--
-- Name: affinity_results; Type: TABLE; Schema: public; Owner: perfil_user
--

CREATE TABLE public.affinity_results (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    student_profile_id uuid NOT NULL,
    academic_area_id uuid NOT NULL,
    score numeric(6,2) DEFAULT '0'::numeric NOT NULL,
    level public.affinity_results_level_enum DEFAULT 'low'::public.affinity_results_level_enum NOT NULL,
    calculated_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.affinity_results OWNER TO perfil_user;

--
-- Name: external_certificates; Type: TABLE; Schema: public; Owner: perfil_user
--

CREATE TABLE public.external_certificates (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    student_profile_id uuid NOT NULL,
    issuer character varying(160) NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    certificate_name character varying(200) NOT NULL,
    certificate_url character varying(500),
    issue_date date
);


ALTER TABLE public.external_certificates OWNER TO perfil_user;

--
-- Name: internal_constancies; Type: TABLE; Schema: public; Owner: perfil_user
--

CREATE TABLE public.internal_constancies (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    student_profile_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    activity_id uuid,
    activity_registration_id uuid,
    description character varying(300) NOT NULL,
    status public.internal_constancies_status_enum DEFAULT 'authorized'::public.internal_constancies_status_enum NOT NULL,
    authorized_by uuid
);


ALTER TABLE public.internal_constancies OWNER TO perfil_user;

--
-- Name: migrations; Type: TABLE; Schema: public; Owner: perfil_user
--

CREATE TABLE public.migrations (
    id integer NOT NULL,
    "timestamp" bigint NOT NULL,
    name character varying NOT NULL
);


ALTER TABLE public.migrations OWNER TO perfil_user;

--
-- Name: migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: perfil_user
--

CREATE SEQUENCE public.migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.migrations_id_seq OWNER TO perfil_user;

--
-- Name: migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: perfil_user
--

ALTER SEQUENCE public.migrations_id_seq OWNED BY public.migrations.id;


--
-- Name: project_evidences; Type: TABLE; Schema: public; Owner: perfil_user
--

CREATE TABLE public.project_evidences (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    project_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    evidence_type public.project_evidences_evidence_type_enum NOT NULL,
    description character varying(300),
    file_url character varying(500),
    external_url character varying(500)
);


ALTER TABLE public.project_evidences OWNER TO perfil_user;

--
-- Name: project_members; Type: TABLE; Schema: public; Owner: perfil_user
--

CREATE TABLE public.project_members (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    project_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    role character varying(80),
    contribution text
);


ALTER TABLE public.project_members OWNER TO perfil_user;

--
-- Name: projects; Type: TABLE; Schema: public; Owner: perfil_user
--

CREATE TABLE public.projects (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    title character varying(160) NOT NULL,
    description text,
    status public.projects_status_enum DEFAULT 'draft'::public.projects_status_enum NOT NULL,
    technologies text[],
    academic_area_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    created_by_profile_id uuid NOT NULL,
    repository_url character varying(500),
    demo_url character varying(500)
);


ALTER TABLE public.projects OWNER TO perfil_user;

--
-- Name: roles; Type: TABLE; Schema: public; Owner: perfil_user
--

CREATE TABLE public.roles (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name public.roles_name_enum NOT NULL,
    description character varying(200),
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.roles OWNER TO perfil_user;

--
-- Name: skills; Type: TABLE; Schema: public; Owner: perfil_user
--

CREATE TABLE public.skills (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(120) NOT NULL,
    academic_area_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.skills OWNER TO perfil_user;

--
-- Name: student_interests; Type: TABLE; Schema: public; Owner: perfil_user
--

CREATE TABLE public.student_interests (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    student_profile_id uuid NOT NULL,
    academic_area_id uuid NOT NULL,
    priority smallint DEFAULT '1'::smallint NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_student_interest_priority CHECK (((priority >= 1) AND (priority <= 5)))
);


ALTER TABLE public.student_interests OWNER TO perfil_user;

--
-- Name: student_profiles; Type: TABLE; Schema: public; Owner: perfil_user
--

CREATE TABLE public.student_profiles (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    university_code character varying(30),
    semester smallint,
    bio text,
    status public.student_profiles_status_enum DEFAULT 'incomplete'::public.student_profiles_status_enum NOT NULL,
    completion_percentage smallint DEFAULT '0'::smallint NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    improvement_area_ids uuid[]
);


ALTER TABLE public.student_profiles OWNER TO perfil_user;

--
-- Name: student_skills; Type: TABLE; Schema: public; Owner: perfil_user
--

CREATE TABLE public.student_skills (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    student_profile_id uuid NOT NULL,
    skill_id uuid NOT NULL,
    level smallint DEFAULT '1'::smallint NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_student_skill_level CHECK (((level >= 1) AND (level <= 5)))
);


ALTER TABLE public.student_skills OWNER TO perfil_user;

--
-- Name: users; Type: TABLE; Schema: public; Owner: perfil_user
--

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    email character varying(160) NOT NULL,
    password_hash character varying(255) NOT NULL,
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    status public.users_status_enum DEFAULT 'active'::public.users_status_enum NOT NULL,
    role_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.users OWNER TO perfil_user;

--
-- Name: migrations id; Type: DEFAULT; Schema: public; Owner: perfil_user
--

ALTER TABLE ONLY public.migrations ALTER COLUMN id SET DEFAULT nextval('public.migrations_id_seq'::regclass);


--
-- Data for Name: academic_areas; Type: TABLE DATA; Schema: public; Owner: perfil_user
--

COPY public.academic_areas (id, name, description, tags, created_at, updated_at) FROM stdin;
51aac523-ce6e-4371-9c9d-063c9f4581d2	Desarrollo Web	Construcción de aplicaciones y servicios para la web.	{frontend,backend,react,node,api,html,css}	2026-06-01 04:26:11.332046	2026-06-01 04:26:11.332046
d269d4d8-ca34-46c6-8aa9-16b1263e8bc0	Desarrollo Móvil	Aplicaciones para dispositivos móviles.	{android,ios,react-native,flutter,kotlin}	2026-06-01 04:26:11.339407	2026-06-01 04:26:11.339407
668ef837-2366-4adb-b085-9a29e0a667e2	Inteligencia Artificial	Aprendizaje automático y sistemas inteligentes.	{machine-learning,python,redes-neuronales,datos}	2026-06-01 04:26:11.346977	2026-06-01 04:26:11.346977
95a1ac1b-1ec5-43b6-8095-0a1a3809bca4	Bases de Datos	Modelado, gestión y optimización de datos.	{sql,postgresql,mongodb,modelado}	2026-06-01 04:26:11.353532	2026-06-01 04:26:11.353532
b5df94c3-bd78-4de1-a5c5-be50e0e0f582	Redes	Infraestructura, comunicaciones y conectividad.	{tcp-ip,routing,linux,infraestructura}	2026-06-01 04:26:11.359543	2026-06-01 04:26:11.359543
5c8d862f-beab-45d1-8da3-fa29f1545669	Ciberseguridad	Protección de sistemas, datos y comunicaciones.	{pentesting,criptografia,vulnerabilidades,seguridad}	2026-06-01 04:26:11.364921	2026-06-01 04:26:11.364921
2a50651b-4a46-48b1-8289-bf1b39813f17	Ingeniería de Software	Procesos, arquitectura y calidad del software.	{uml,patrones,testing,git,arquitectura}	2026-06-01 04:26:11.369331	2026-06-01 04:26:11.369331
51274b3a-f2c6-457e-a6d0-b9f3b53d1a17	Gestión de Proyectos	Planificación y liderazgo de proyectos tecnológicos.	{scrum,kanban,liderazgo,planificacion}	2026-06-01 04:26:11.373704	2026-06-01 04:26:11.373704
\.


--
-- Data for Name: activities; Type: TABLE DATA; Schema: public; Owner: perfil_user
--

COPY public.activities (id, title, description, type, modality, academic_area_id, creator_id, event_date, capacity, status, tags, created_at, updated_at, category, location, external_url, evidence_required) FROM stdin;
79151de5-2aa2-482f-b5c6-3926287885d0	Taller de Desarrollo Web	Taller de Desarrollo Web para estudiantes de Ingeniería en Sistemas.	academica	presencial	51aac523-ce6e-4371-9c9d-063c9f4581d2	036371dd-0abe-4a59-8c1a-5069fe5a43d3	\N	20	open	\N	2026-06-01 04:26:12.022882	2026-06-01 04:26:12.022882	taller_academico	\N	\N	f
a9f169f2-148b-40a8-8200-933176296859	Seminario de Inteligencia Artificial	Seminario de Inteligencia Artificial para estudiantes de Ingeniería en Sistemas.	academica	presencial	668ef837-2366-4adb-b085-9a29e0a667e2	036371dd-0abe-4a59-8c1a-5069fe5a43d3	\N	30	open	\N	2026-06-01 04:26:12.029046	2026-06-01 04:26:12.029046	seminario	\N	\N	f
008d1a0c-e0f7-4fbc-a773-1f768bacfe96	Reto de Bases de Datos	Reto de Bases de Datos para estudiantes de Ingeniería en Sistemas.	academica	presencial	95a1ac1b-1ec5-43b6-8095-0a1a3809bca4	43aa4c25-f10a-42ee-a150-aa431014b218	\N	15	open	\N	2026-06-01 04:26:12.033727	2026-06-01 04:26:12.033727	reto	\N	\N	f
d1eb23ea-cc60-4cbc-a400-6b403864d37a	Clase espejo de Ingeniería de Software	Clase espejo de Ingeniería de Software para estudiantes de Ingeniería en Sistemas.	academica	presencial	2a50651b-4a46-48b1-8289-bf1b39813f17	43aa4c25-f10a-42ee-a150-aa431014b218	\N	25	open	\N	2026-06-01 04:26:12.038024	2026-06-01 04:26:12.038024	clase_espejo	\N	\N	f
a130de26-2c6e-42e5-bc9b-e5b0fbf1f2e0	Charla de Ciberseguridad	Charla de Ciberseguridad para estudiantes de Ingeniería en Sistemas.	academica	presencial	5c8d862f-beab-45d1-8da3-fa29f1545669	036371dd-0abe-4a59-8c1a-5069fe5a43d3	\N	40	open	\N	2026-06-01 04:26:12.042421	2026-06-01 04:26:12.042421	charla	\N	\N	f
c6b7a6b2-a6ad-4763-9f5f-345b712028cf	Tutoría de Redes	Tutoría de Redes para estudiantes de Ingeniería en Sistemas.	academica	presencial	b5df94c3-bd78-4de1-a5c5-be50e0e0f582	43aa4c25-f10a-42ee-a150-aa431014b218	\N	12	open	\N	2026-06-01 04:26:12.04698	2026-06-01 04:26:12.04698	tutoria	\N	\N	f
78ee32f6-6953-4820-9bf8-fbf421091dcc	Hackathon de Innovación	Hackathon de Innovación para estudiantes de Ingeniería en Sistemas.	extracurricular	presencial	668ef837-2366-4adb-b085-9a29e0a667e2	88674fd8-2ac8-4419-81dd-2264288047ab	\N	50	open	\N	2026-06-01 04:26:12.051248	2026-06-01 04:26:12.051248	hackathon	\N	\N	f
8ef9591b-420b-4b52-a6b7-815ff35368a3	Club de Estudio de Desarrollo Móvil	Club de Estudio de Desarrollo Móvil para estudiantes de Ingeniería en Sistemas.	extracurricular	presencial	d269d4d8-ca34-46c6-8aa9-16b1263e8bc0	88674fd8-2ac8-4419-81dd-2264288047ab	\N	20	open	\N	2026-06-01 04:26:12.055778	2026-06-01 04:26:12.055778	club_estudio	\N	\N	f
73c0db9c-d295-4729-b7a6-99ed094c152c	Actividad de Responsabilidad Social	Actividad de Responsabilidad Social para estudiantes de Ingeniería en Sistemas.	extracurricular	presencial	51274b3a-f2c6-457e-a6d0-b9f3b53d1a17	88674fd8-2ac8-4419-81dd-2264288047ab	\N	30	open	\N	2026-06-01 04:26:12.060359	2026-06-01 04:26:12.060359	responsabilidad_social	\N	\N	f
8dc246ab-2b14-40c0-9ccf-f351b557864c	TALLER DE CIBERSEGURIDAD	TALLER MUY IMPORTANTE DE CONOCIMIENTO NUEVAS TECNOLOGIAS DE CIBERSEGURIDAD	academica	virtual	5c8d862f-beab-45d1-8da3-fa29f1545669	036371dd-0abe-4a59-8c1a-5069fe5a43d3	\N	20	open	\N	2026-06-01 12:42:15.22965	2026-06-01 12:42:15.22965	taller_academico	\N	\N	f
\.


--
-- Data for Name: activity_registrations; Type: TABLE DATA; Schema: public; Owner: perfil_user
--

COPY public.activity_registrations (id, activity_id, student_profile_id, status, confirmed_by, created_at, updated_at) FROM stdin;
61261f13-aea3-4cb8-852c-eb59864e2592	79151de5-2aa2-482f-b5c6-3926287885d0	b837e364-78fc-41c7-abad-760383338234	confirmed	036371dd-0abe-4a59-8c1a-5069fe5a43d3	2026-06-01 04:26:12.065502	2026-06-01 04:26:12.065502
df08be72-aff1-49f3-a66f-afacdab02fd9	a130de26-2c6e-42e5-bc9b-e5b0fbf1f2e0	b837e364-78fc-41c7-abad-760383338234	registered	\N	2026-06-01 04:26:12.070552	2026-06-01 04:26:12.070552
6d7424ed-1c93-4860-8605-9a93cf7a4941	008d1a0c-e0f7-4fbc-a773-1f768bacfe96	b837e364-78fc-41c7-abad-760383338234	interested	\N	2026-06-01 04:26:12.074536	2026-06-01 04:26:12.074536
7e661a91-6801-444a-8fea-1767787abc9c	a9f169f2-148b-40a8-8200-933176296859	b7908e30-ab2c-426d-a516-ca603de04350	confirmed	036371dd-0abe-4a59-8c1a-5069fe5a43d3	2026-06-01 04:26:12.078987	2026-06-01 04:26:12.078987
9e6ed30c-073c-4e02-9e83-bc134c257be6	c6b7a6b2-a6ad-4763-9f5f-345b712028cf	b7908e30-ab2c-426d-a516-ca603de04350	registered	\N	2026-06-01 04:26:12.083283	2026-06-01 04:26:12.083283
d40f9141-2787-48f2-ae87-ede776cd1cef	d1eb23ea-cc60-4cbc-a400-6b403864d37a	b7908e30-ab2c-426d-a516-ca603de04350	interested	\N	2026-06-01 04:26:12.087551	2026-06-01 04:26:12.087551
dfd5a432-4500-45da-aca2-cd65998f21d3	008d1a0c-e0f7-4fbc-a773-1f768bacfe96	fdbeb71b-7f93-454f-85b6-5f73771a2247	confirmed	43aa4c25-f10a-42ee-a150-aa431014b218	2026-06-01 04:26:12.092151	2026-06-01 04:26:12.092151
26f1d524-b808-4fd0-a764-6de20c68c998	78ee32f6-6953-4820-9bf8-fbf421091dcc	fdbeb71b-7f93-454f-85b6-5f73771a2247	registered	\N	2026-06-01 04:26:12.096578	2026-06-01 04:26:12.096578
ead16319-5194-4ea1-99b3-dda046589b4d	a130de26-2c6e-42e5-bc9b-e5b0fbf1f2e0	fdbeb71b-7f93-454f-85b6-5f73771a2247	interested	\N	2026-06-01 04:26:12.100748	2026-06-01 04:26:12.100748
e5c021a3-59f0-4366-8e13-df5cd3d65379	d1eb23ea-cc60-4cbc-a400-6b403864d37a	324ed052-b5d5-43a9-b006-4221fbfedca2	confirmed	43aa4c25-f10a-42ee-a150-aa431014b218	2026-06-01 04:26:12.104878	2026-06-01 04:26:12.104878
e13d017b-3552-4ad9-970f-12b9387bd4ba	8ef9591b-420b-4b52-a6b7-815ff35368a3	324ed052-b5d5-43a9-b006-4221fbfedca2	registered	\N	2026-06-01 04:26:12.108653	2026-06-01 04:26:12.108653
ff2a02b5-599f-44c8-a99f-f6726f09c1bd	c6b7a6b2-a6ad-4763-9f5f-345b712028cf	324ed052-b5d5-43a9-b006-4221fbfedca2	interested	\N	2026-06-01 04:26:12.112429	2026-06-01 04:26:12.112429
1017a83f-98b8-4d86-8fbd-61bf81b7c87b	a130de26-2c6e-42e5-bc9b-e5b0fbf1f2e0	74661e76-0b41-4963-9533-8eefd11fc7fe	confirmed	036371dd-0abe-4a59-8c1a-5069fe5a43d3	2026-06-01 04:26:12.118747	2026-06-01 04:26:12.118747
5e1b7a51-cb1e-4ab9-a888-715a20d472e5	73c0db9c-d295-4729-b7a6-99ed094c152c	74661e76-0b41-4963-9533-8eefd11fc7fe	registered	\N	2026-06-01 04:26:12.12284	2026-06-01 04:26:12.12284
c8c2a9c9-a515-4529-87c1-6270841e3e82	78ee32f6-6953-4820-9bf8-fbf421091dcc	74661e76-0b41-4963-9533-8eefd11fc7fe	interested	\N	2026-06-01 04:26:12.126377	2026-06-01 04:26:12.126377
5fd6a079-d1cf-41dc-ad42-ab9ef28afa01	c6b7a6b2-a6ad-4763-9f5f-345b712028cf	50acf2c8-e09a-4937-b3be-57c3dfe036b2	confirmed	43aa4c25-f10a-42ee-a150-aa431014b218	2026-06-01 04:26:12.130503	2026-06-01 04:26:12.130503
db6ecdae-4b75-4d07-91a4-fad7f8c90e5f	79151de5-2aa2-482f-b5c6-3926287885d0	50acf2c8-e09a-4937-b3be-57c3dfe036b2	registered	\N	2026-06-01 04:26:12.134575	2026-06-01 04:26:12.134575
43c9b764-cd17-48cf-9f2a-638a2c26a043	8ef9591b-420b-4b52-a6b7-815ff35368a3	50acf2c8-e09a-4937-b3be-57c3dfe036b2	interested	\N	2026-06-01 04:26:12.138717	2026-06-01 04:26:12.138717
1c5d50b5-a842-4b36-b1e0-721f80f70f4a	78ee32f6-6953-4820-9bf8-fbf421091dcc	c43c385e-189d-4870-aa5b-e63c3cbda86d	confirmed	88674fd8-2ac8-4419-81dd-2264288047ab	2026-06-01 04:26:12.142821	2026-06-01 04:26:12.142821
e4d8daa0-e60f-4c78-a81b-d253b9336dc4	a9f169f2-148b-40a8-8200-933176296859	c43c385e-189d-4870-aa5b-e63c3cbda86d	registered	\N	2026-06-01 04:26:12.147301	2026-06-01 04:26:12.147301
3036e5ce-7876-4ee5-aa43-20a3463dc3b5	73c0db9c-d295-4729-b7a6-99ed094c152c	c43c385e-189d-4870-aa5b-e63c3cbda86d	interested	\N	2026-06-01 04:26:12.15182	2026-06-01 04:26:12.15182
952ab5f5-aabe-4f55-be90-4aed10d60bdc	8ef9591b-420b-4b52-a6b7-815ff35368a3	b6d55a61-fea9-4f6e-8848-a3cd958d58eb	confirmed	88674fd8-2ac8-4419-81dd-2264288047ab	2026-06-01 04:26:12.155561	2026-06-01 04:26:12.155561
99863bd3-ce45-421d-ba8a-aba35896a8d1	008d1a0c-e0f7-4fbc-a773-1f768bacfe96	b6d55a61-fea9-4f6e-8848-a3cd958d58eb	registered	\N	2026-06-01 04:26:12.159686	2026-06-01 04:26:12.159686
15064c30-11a0-415e-88bf-370b6e96d4d2	79151de5-2aa2-482f-b5c6-3926287885d0	b6d55a61-fea9-4f6e-8848-a3cd958d58eb	interested	\N	2026-06-01 04:26:12.163891	2026-06-01 04:26:12.163891
d7fcccd4-f444-4234-93e0-c28ea582fa6c	73c0db9c-d295-4729-b7a6-99ed094c152c	868fed75-e7c6-4bfb-b557-1c75579bc204	confirmed	88674fd8-2ac8-4419-81dd-2264288047ab	2026-06-01 04:26:12.1682	2026-06-01 04:26:12.1682
2541d4d9-59eb-4699-a218-d37e43681aec	d1eb23ea-cc60-4cbc-a400-6b403864d37a	868fed75-e7c6-4bfb-b557-1c75579bc204	registered	\N	2026-06-01 04:26:12.172445	2026-06-01 04:26:12.172445
b5deb58c-f1fa-4927-92ae-6d6eb52a7a29	a9f169f2-148b-40a8-8200-933176296859	868fed75-e7c6-4bfb-b557-1c75579bc204	interested	\N	2026-06-01 04:26:12.176389	2026-06-01 04:26:12.176389
9fc0b787-5a0f-44b3-a6e9-5d6275c94c43	79151de5-2aa2-482f-b5c6-3926287885d0	b5619243-a8d8-473b-880e-2fd277e99056	confirmed	036371dd-0abe-4a59-8c1a-5069fe5a43d3	2026-06-01 04:26:12.180608	2026-06-01 04:26:12.180608
95000545-e58e-4c33-bf46-5e05758624a6	a130de26-2c6e-42e5-bc9b-e5b0fbf1f2e0	b5619243-a8d8-473b-880e-2fd277e99056	registered	\N	2026-06-01 04:26:12.185713	2026-06-01 04:26:12.185713
18704a76-8cfb-4eac-92df-0569ce11f258	008d1a0c-e0f7-4fbc-a773-1f768bacfe96	b5619243-a8d8-473b-880e-2fd277e99056	interested	\N	2026-06-01 04:26:12.190431	2026-06-01 04:26:12.190431
801b9810-590a-44f4-90fc-41ac52e74f43	a9f169f2-148b-40a8-8200-933176296859	00328739-b61c-4944-a520-73a039177ecd	confirmed	036371dd-0abe-4a59-8c1a-5069fe5a43d3	2026-06-01 04:26:12.195411	2026-06-01 04:26:12.195411
b727cdb1-2b65-4ba4-9df9-5c4459c9dfff	c6b7a6b2-a6ad-4763-9f5f-345b712028cf	00328739-b61c-4944-a520-73a039177ecd	registered	\N	2026-06-01 04:26:12.199699	2026-06-01 04:26:12.199699
cfca27f0-db20-47d8-bd43-b319d5bc5012	d1eb23ea-cc60-4cbc-a400-6b403864d37a	00328739-b61c-4944-a520-73a039177ecd	interested	\N	2026-06-01 04:26:12.203898	2026-06-01 04:26:12.203898
a9f09750-f9b9-4a43-92a7-e63b7e65269c	008d1a0c-e0f7-4fbc-a773-1f768bacfe96	04a62e3f-86d1-4611-8da2-9cc4f8fceb0f	confirmed	43aa4c25-f10a-42ee-a150-aa431014b218	2026-06-01 04:26:12.208433	2026-06-01 04:26:12.208433
c890d591-f27a-4c60-ad7a-c179b2d65e08	78ee32f6-6953-4820-9bf8-fbf421091dcc	04a62e3f-86d1-4611-8da2-9cc4f8fceb0f	registered	\N	2026-06-01 04:26:12.212952	2026-06-01 04:26:12.212952
8dbb1e00-65a6-46e4-b314-dc8f2a949958	a130de26-2c6e-42e5-bc9b-e5b0fbf1f2e0	04a62e3f-86d1-4611-8da2-9cc4f8fceb0f	interested	\N	2026-06-01 04:26:12.216898	2026-06-01 04:26:12.216898
d8460007-b8ac-41b7-9c10-efe193c53e68	d1eb23ea-cc60-4cbc-a400-6b403864d37a	6f2e5a45-c65f-4bc9-a550-6f84d71d997e	confirmed	43aa4c25-f10a-42ee-a150-aa431014b218	2026-06-01 04:26:12.220825	2026-06-01 04:26:12.220825
3cf1302d-2429-4e20-bc5f-4213634dcca2	8ef9591b-420b-4b52-a6b7-815ff35368a3	6f2e5a45-c65f-4bc9-a550-6f84d71d997e	registered	\N	2026-06-01 04:26:12.22488	2026-06-01 04:26:12.22488
c3068f61-a504-4323-a1d0-bb0178fc5908	c6b7a6b2-a6ad-4763-9f5f-345b712028cf	6f2e5a45-c65f-4bc9-a550-6f84d71d997e	interested	\N	2026-06-01 04:26:12.229587	2026-06-01 04:26:12.229587
63448d09-93b6-4b10-b27d-74f86cf61f52	a130de26-2c6e-42e5-bc9b-e5b0fbf1f2e0	de92a500-0f51-4e3b-9895-9d90b1280bda	confirmed	036371dd-0abe-4a59-8c1a-5069fe5a43d3	2026-06-01 04:26:12.234135	2026-06-01 04:26:12.234135
bb24a5bf-2768-49b7-ab3d-f959aad71006	73c0db9c-d295-4729-b7a6-99ed094c152c	de92a500-0f51-4e3b-9895-9d90b1280bda	registered	\N	2026-06-01 04:26:12.237955	2026-06-01 04:26:12.237955
a3938df4-9d4f-4102-bd25-cbb497ef40ae	78ee32f6-6953-4820-9bf8-fbf421091dcc	de92a500-0f51-4e3b-9895-9d90b1280bda	interested	\N	2026-06-01 04:26:12.242239	2026-06-01 04:26:12.242239
15057723-4ed6-41e9-b0c6-73c3a0e628fa	c6b7a6b2-a6ad-4763-9f5f-345b712028cf	5dd773e0-e116-4be2-bb86-df8bb8ff749e	confirmed	43aa4c25-f10a-42ee-a150-aa431014b218	2026-06-01 04:26:12.246093	2026-06-01 04:26:12.246093
2d3c456d-fcee-4a83-a1d4-edcd592a8715	79151de5-2aa2-482f-b5c6-3926287885d0	5dd773e0-e116-4be2-bb86-df8bb8ff749e	registered	\N	2026-06-01 04:26:12.24992	2026-06-01 04:26:12.24992
34755d59-b2d8-470a-9d0f-ddc94fd8a8c4	8ef9591b-420b-4b52-a6b7-815ff35368a3	5dd773e0-e116-4be2-bb86-df8bb8ff749e	interested	\N	2026-06-01 04:26:12.253774	2026-06-01 04:26:12.253774
e0a3bba8-543d-449f-85cb-82baa7c74e24	78ee32f6-6953-4820-9bf8-fbf421091dcc	48dba40b-6b1f-4b70-86cf-5e73eadb7dbd	confirmed	88674fd8-2ac8-4419-81dd-2264288047ab	2026-06-01 04:26:12.258187	2026-06-01 04:26:12.258187
9bfd6ba3-125f-47f0-aa6e-3afcd9eba53a	a9f169f2-148b-40a8-8200-933176296859	48dba40b-6b1f-4b70-86cf-5e73eadb7dbd	registered	\N	2026-06-01 04:26:12.262569	2026-06-01 04:26:12.262569
2208c6d6-4365-4dfc-9164-a616a66e70e8	73c0db9c-d295-4729-b7a6-99ed094c152c	48dba40b-6b1f-4b70-86cf-5e73eadb7dbd	interested	\N	2026-06-01 04:26:12.266561	2026-06-01 04:26:12.266561
2933dceb-3de4-4f9d-ab1e-fe332e7b2bce	73c0db9c-d295-4729-b7a6-99ed094c152c	b837e364-78fc-41c7-abad-760383338234	registered	\N	2026-06-01 04:29:14.20312	2026-06-01 04:31:14.209976
4a94dcae-c83e-470c-a009-26acb49e3340	8dc246ab-2b14-40c0-9ccf-f351b557864c	b837e364-78fc-41c7-abad-760383338234	registered	\N	2026-06-01 12:43:42.216778	2026-06-01 12:43:42.216778
\.


--
-- Data for Name: affinity_results; Type: TABLE DATA; Schema: public; Owner: perfil_user
--

COPY public.affinity_results (id, student_profile_id, academic_area_id, score, level, calculated_at, updated_at) FROM stdin;
c72efb15-3f90-4313-8767-34d1d28fb793	b7908e30-ab2c-426d-a516-ca603de04350	5c8d862f-beab-45d1-8da3-fa29f1545669	8.00	medium	2026-06-01 04:26:12.492808	2026-06-01 04:26:12.492808
c791513c-be9a-40cd-9edf-90aa40403b7a	b7908e30-ab2c-426d-a516-ca603de04350	51274b3a-f2c6-457e-a6d0-b9f3b53d1a17	5.00	medium	2026-06-01 04:26:12.492808	2026-06-01 04:26:12.492808
cfe0c000-e888-4a43-828c-b54fab8b3b7a	b7908e30-ab2c-426d-a516-ca603de04350	668ef837-2366-4adb-b085-9a29e0a667e2	6.00	medium	2026-06-01 04:26:12.492808	2026-06-01 04:26:12.492808
51d4e8e6-b2e7-486d-861d-130fbcea5b8a	b7908e30-ab2c-426d-a516-ca603de04350	2a50651b-4a46-48b1-8289-bf1b39813f17	1.00	low	2026-06-01 04:26:12.492808	2026-06-01 04:26:12.492808
d744a536-f4a0-4db1-b428-a67dae0c111e	b7908e30-ab2c-426d-a516-ca603de04350	b5df94c3-bd78-4de1-a5c5-be50e0e0f582	2.00	low	2026-06-01 04:26:12.492808	2026-06-01 04:26:12.492808
b7b930cd-cd61-49b5-a1b8-9da505a146a1	fdbeb71b-7f93-454f-85b6-5f73771a2247	d269d4d8-ca34-46c6-8aa9-16b1263e8bc0	17.00	high	2026-06-01 04:26:12.525237	2026-06-01 04:26:12.525237
5bef1ea8-63e3-43f0-97f3-7f112934c1f3	fdbeb71b-7f93-454f-85b6-5f73771a2247	2a50651b-4a46-48b1-8289-bf1b39813f17	5.00	medium	2026-06-01 04:26:12.525237	2026-06-01 04:26:12.525237
b159ac80-90b3-4284-9076-d5dd028d425e	fdbeb71b-7f93-454f-85b6-5f73771a2247	95a1ac1b-1ec5-43b6-8095-0a1a3809bca4	6.00	medium	2026-06-01 04:26:12.525237	2026-06-01 04:26:12.525237
e83f6a4b-2de4-4a73-86fd-f6ebd902f570	fdbeb71b-7f93-454f-85b6-5f73771a2247	5c8d862f-beab-45d1-8da3-fa29f1545669	1.00	low	2026-06-01 04:26:12.525237	2026-06-01 04:26:12.525237
174fff4e-802c-4409-90dc-687a84a28c0e	fdbeb71b-7f93-454f-85b6-5f73771a2247	668ef837-2366-4adb-b085-9a29e0a667e2	2.00	low	2026-06-01 04:26:12.525237	2026-06-01 04:26:12.525237
4f8f1fd2-af11-4195-b84e-77e870844b3d	324ed052-b5d5-43a9-b006-4221fbfedca2	51aac523-ce6e-4371-9c9d-063c9f4581d2	5.00	medium	2026-06-01 04:26:12.552948	2026-06-01 04:26:12.552948
6d246180-85f1-4f16-8ae3-8793165d3dae	324ed052-b5d5-43a9-b006-4221fbfedca2	668ef837-2366-4adb-b085-9a29e0a667e2	6.00	medium	2026-06-01 04:26:12.552948	2026-06-01 04:26:12.552948
e3b80298-8912-41bc-843c-81b88389dacf	324ed052-b5d5-43a9-b006-4221fbfedca2	2a50651b-4a46-48b1-8289-bf1b39813f17	6.00	medium	2026-06-01 04:26:12.552948	2026-06-01 04:26:12.552948
37f0da8c-05a8-4e57-853e-b66afdb82a9a	324ed052-b5d5-43a9-b006-4221fbfedca2	b5df94c3-bd78-4de1-a5c5-be50e0e0f582	1.00	low	2026-06-01 04:26:12.552948	2026-06-01 04:26:12.552948
1b6f8980-c5f5-4d93-aec0-2478e8a1dd11	324ed052-b5d5-43a9-b006-4221fbfedca2	d269d4d8-ca34-46c6-8aa9-16b1263e8bc0	2.00	low	2026-06-01 04:26:12.552948	2026-06-01 04:26:12.552948
e8e56917-dce3-4e8c-9bda-f2f44f832598	74661e76-0b41-4963-9533-8eefd11fc7fe	51274b3a-f2c6-457e-a6d0-b9f3b53d1a17	19.00	high	2026-06-01 04:26:12.580384	2026-06-01 04:26:12.580384
f4a0a5bc-c315-4801-a4a5-1f5e20e6da21	74661e76-0b41-4963-9533-8eefd11fc7fe	b5df94c3-bd78-4de1-a5c5-be50e0e0f582	5.00	medium	2026-06-01 04:26:12.580384	2026-06-01 04:26:12.580384
4c46db07-be12-4865-8bbf-e91f5b65b8c7	74661e76-0b41-4963-9533-8eefd11fc7fe	5c8d862f-beab-45d1-8da3-fa29f1545669	3.00	low	2026-06-01 04:26:12.580384	2026-06-01 04:26:12.580384
86f7b16b-f2ef-4db3-8abe-1949aedd0bb4	74661e76-0b41-4963-9533-8eefd11fc7fe	668ef837-2366-4adb-b085-9a29e0a667e2	1.00	low	2026-06-01 04:26:12.580384	2026-06-01 04:26:12.580384
f06fe0d0-dde9-42d1-b5aa-ab32e6113e72	50acf2c8-e09a-4937-b3be-57c3dfe036b2	2a50651b-4a46-48b1-8289-bf1b39813f17	8.00	medium	2026-06-01 04:26:12.604085	2026-06-01 04:26:12.604085
126754da-0f37-447f-8990-d695424b01cb	50acf2c8-e09a-4937-b3be-57c3dfe036b2	95a1ac1b-1ec5-43b6-8095-0a1a3809bca4	5.00	medium	2026-06-01 04:26:12.604085	2026-06-01 04:26:12.604085
6a3e1d98-0a54-430a-8b96-a6be684c97db	50acf2c8-e09a-4937-b3be-57c3dfe036b2	51aac523-ce6e-4371-9c9d-063c9f4581d2	2.00	low	2026-06-01 04:26:12.604085	2026-06-01 04:26:12.604085
028384c8-cfb7-4f09-8bea-69153e992ea1	50acf2c8-e09a-4937-b3be-57c3dfe036b2	b5df94c3-bd78-4de1-a5c5-be50e0e0f582	3.00	low	2026-06-01 04:26:12.604085	2026-06-01 04:26:12.604085
d02d27af-8d0a-4ea5-9369-1fe15a95f7f1	50acf2c8-e09a-4937-b3be-57c3dfe036b2	d269d4d8-ca34-46c6-8aa9-16b1263e8bc0	1.00	low	2026-06-01 04:26:12.604085	2026-06-01 04:26:12.604085
f309c5d4-121c-4516-8523-ddc9134ec1af	50acf2c8-e09a-4937-b3be-57c3dfe036b2	668ef837-2366-4adb-b085-9a29e0a667e2	4.00	low	2026-06-01 04:26:12.604085	2026-06-01 04:26:12.604085
0c570df9-b5bf-4a82-b416-8020aeaacda0	c43c385e-189d-4870-aa5b-e63c3cbda86d	668ef837-2366-4adb-b085-9a29e0a667e2	22.00	high	2026-06-01 04:26:12.62963	2026-06-01 04:26:12.62963
28e26578-cc1b-41f0-a2c7-35dd3dcf6238	c43c385e-189d-4870-aa5b-e63c3cbda86d	5c8d862f-beab-45d1-8da3-fa29f1545669	5.00	medium	2026-06-01 04:26:12.62963	2026-06-01 04:26:12.62963
cead6c19-fbc7-4c0e-9660-2d3a297d63dc	c43c385e-189d-4870-aa5b-e63c3cbda86d	51274b3a-f2c6-457e-a6d0-b9f3b53d1a17	1.00	low	2026-06-01 04:26:12.62963	2026-06-01 04:26:12.62963
4ccde312-d71e-491e-97c8-95021db9f0e0	b6d55a61-fea9-4f6e-8848-a3cd958d58eb	b5df94c3-bd78-4de1-a5c5-be50e0e0f582	8.00	medium	2026-06-01 04:26:12.65509	2026-06-01 04:26:12.65509
0dde7edf-3e18-4e2d-ba81-5d7e458328d4	b6d55a61-fea9-4f6e-8848-a3cd958d58eb	d269d4d8-ca34-46c6-8aa9-16b1263e8bc0	8.00	medium	2026-06-01 04:26:12.65509	2026-06-01 04:26:12.65509
af2258a1-ef70-4246-8a78-1909a02f1ff4	b6d55a61-fea9-4f6e-8848-a3cd958d58eb	51aac523-ce6e-4371-9c9d-063c9f4581d2	1.00	low	2026-06-01 04:26:12.65509	2026-06-01 04:26:12.65509
2129c81f-7e2e-46fd-aeab-6742bbf4ce25	b6d55a61-fea9-4f6e-8848-a3cd958d58eb	95a1ac1b-1ec5-43b6-8095-0a1a3809bca4	2.00	low	2026-06-01 04:26:12.65509	2026-06-01 04:26:12.65509
42b3fa65-dc8d-4665-93cc-541f1326d04a	b6d55a61-fea9-4f6e-8848-a3cd958d58eb	51274b3a-f2c6-457e-a6d0-b9f3b53d1a17	4.00	low	2026-06-01 04:26:12.65509	2026-06-01 04:26:12.65509
aec57d5d-8f6c-4c05-811e-0c46c450e2b0	868fed75-e7c6-4bfb-b557-1c75579bc204	95a1ac1b-1ec5-43b6-8095-0a1a3809bca4	17.00	high	2026-06-01 04:26:12.680908	2026-06-01 04:26:12.680908
c17189e7-2eb9-4d0a-aa7d-adad3b229781	868fed75-e7c6-4bfb-b557-1c75579bc204	51aac523-ce6e-4371-9c9d-063c9f4581d2	5.00	medium	2026-06-01 04:26:12.680908	2026-06-01 04:26:12.680908
a480408c-cf3f-463b-8667-06795d4b44d7	868fed75-e7c6-4bfb-b557-1c75579bc204	668ef837-2366-4adb-b085-9a29e0a667e2	1.00	low	2026-06-01 04:26:12.680908	2026-06-01 04:26:12.680908
a02a8eba-71a1-4d23-bf5e-b3fbd7d159ef	868fed75-e7c6-4bfb-b557-1c75579bc204	2a50651b-4a46-48b1-8289-bf1b39813f17	2.00	low	2026-06-01 04:26:12.680908	2026-06-01 04:26:12.680908
f1d91fcf-b972-4c2d-a6fa-22a83b9bce18	868fed75-e7c6-4bfb-b557-1c75579bc204	51274b3a-f2c6-457e-a6d0-b9f3b53d1a17	3.00	low	2026-06-01 04:26:12.680908	2026-06-01 04:26:12.680908
3313fd23-6685-4c4e-a64d-f24ac0e96ea7	b5619243-a8d8-473b-880e-2fd277e99056	5c8d862f-beab-45d1-8da3-fa29f1545669	10.00	medium	2026-06-01 04:26:12.705769	2026-06-01 04:26:12.705769
bdfc0f22-534c-427a-bb9c-d12d09962a3c	b5619243-a8d8-473b-880e-2fd277e99056	51274b3a-f2c6-457e-a6d0-b9f3b53d1a17	5.00	medium	2026-06-01 04:26:12.705769	2026-06-01 04:26:12.705769
6927f24f-fce1-40b7-8b1e-18f37d0a10e6	b5619243-a8d8-473b-880e-2fd277e99056	51aac523-ce6e-4371-9c9d-063c9f4581d2	3.00	low	2026-06-01 04:26:12.705769	2026-06-01 04:26:12.705769
90396f31-15ae-4a10-918f-d136d7f50578	b5619243-a8d8-473b-880e-2fd277e99056	95a1ac1b-1ec5-43b6-8095-0a1a3809bca4	1.00	low	2026-06-01 04:26:12.705769	2026-06-01 04:26:12.705769
98b1712d-e19d-4bb0-97a7-2ab92be88f06	00328739-b61c-4944-a520-73a039177ecd	d269d4d8-ca34-46c6-8aa9-16b1263e8bc0	17.00	high	2026-06-01 04:26:12.730989	2026-06-01 04:26:12.730989
c2da5776-4e08-454a-b393-1ab2adfcd63b	00328739-b61c-4944-a520-73a039177ecd	2a50651b-4a46-48b1-8289-bf1b39813f17	6.00	medium	2026-06-01 04:26:12.730989	2026-06-01 04:26:12.730989
3b134d36-88c8-44e6-91a9-66420eed152a	00328739-b61c-4944-a520-73a039177ecd	668ef837-2366-4adb-b085-9a29e0a667e2	3.00	low	2026-06-01 04:26:12.730989	2026-06-01 04:26:12.730989
0eb9f218-e1a4-41a4-b626-5889eb76d16e	00328739-b61c-4944-a520-73a039177ecd	b5df94c3-bd78-4de1-a5c5-be50e0e0f582	2.00	low	2026-06-01 04:26:12.730989	2026-06-01 04:26:12.730989
2cc9280b-5255-4ffd-b144-99f1d814572e	04a62e3f-86d1-4611-8da2-9cc4f8fceb0f	51aac523-ce6e-4371-9c9d-063c9f4581d2	5.00	medium	2026-06-01 04:26:12.753666	2026-06-01 04:26:12.753666
763af4f1-e0b5-4ca9-844c-fdd2c5b20c87	04a62e3f-86d1-4611-8da2-9cc4f8fceb0f	668ef837-2366-4adb-b085-9a29e0a667e2	8.00	medium	2026-06-01 04:26:12.753666	2026-06-01 04:26:12.753666
fdbd4049-c6d3-47b9-af3e-1934dfd1f84b	04a62e3f-86d1-4611-8da2-9cc4f8fceb0f	95a1ac1b-1ec5-43b6-8095-0a1a3809bca4	3.00	low	2026-06-01 04:26:12.753666	2026-06-01 04:26:12.753666
ea54e9fe-5638-4b34-a59a-bf986ef6ffac	04a62e3f-86d1-4611-8da2-9cc4f8fceb0f	5c8d862f-beab-45d1-8da3-fa29f1545669	1.00	low	2026-06-01 04:26:12.753666	2026-06-01 04:26:12.753666
e17ef776-3cac-4224-8cb0-9b809a60a661	6f2e5a45-c65f-4bc9-a550-6f84d71d997e	51274b3a-f2c6-457e-a6d0-b9f3b53d1a17	17.00	high	2026-06-01 04:26:12.779424	2026-06-01 04:26:12.779424
82dfee42-c270-4ba6-b336-595665460581	6f2e5a45-c65f-4bc9-a550-6f84d71d997e	b5df94c3-bd78-4de1-a5c5-be50e0e0f582	6.00	medium	2026-06-01 04:26:12.779424	2026-06-01 04:26:12.779424
9401da43-120b-4b80-ab0c-3df82d6f9048	6f2e5a45-c65f-4bc9-a550-6f84d71d997e	2a50651b-4a46-48b1-8289-bf1b39813f17	3.00	low	2026-06-01 04:26:12.779424	2026-06-01 04:26:12.779424
af0a4b73-3097-49c5-96ab-ba575a940c1c	6f2e5a45-c65f-4bc9-a550-6f84d71d997e	d269d4d8-ca34-46c6-8aa9-16b1263e8bc0	2.00	low	2026-06-01 04:26:12.779424	2026-06-01 04:26:12.779424
1ae6fa25-28f3-4f61-a7a1-3d9f693913b7	de92a500-0f51-4e3b-9895-9d90b1280bda	2a50651b-4a46-48b1-8289-bf1b39813f17	8.00	medium	2026-06-01 04:26:12.802906	2026-06-01 04:26:12.802906
03037b72-5832-40c5-814b-f3b728bda27c	de92a500-0f51-4e3b-9895-9d90b1280bda	95a1ac1b-1ec5-43b6-8095-0a1a3809bca4	5.00	medium	2026-06-01 04:26:12.802906	2026-06-01 04:26:12.802906
6c095562-30da-41cf-9532-43b168fad4a2	de92a500-0f51-4e3b-9895-9d90b1280bda	5c8d862f-beab-45d1-8da3-fa29f1545669	3.00	low	2026-06-01 04:26:12.802906	2026-06-01 04:26:12.802906
f857b0a6-efda-46e9-9cd0-1f1600a7a450	de92a500-0f51-4e3b-9895-9d90b1280bda	668ef837-2366-4adb-b085-9a29e0a667e2	1.00	low	2026-06-01 04:26:12.802906	2026-06-01 04:26:12.802906
4b6a1e86-f5d5-477b-adcc-70ea18261932	de92a500-0f51-4e3b-9895-9d90b1280bda	51274b3a-f2c6-457e-a6d0-b9f3b53d1a17	2.00	low	2026-06-01 04:26:12.802906	2026-06-01 04:26:12.802906
741e8665-3eba-4da5-83bd-21d97d8d8f8d	5dd773e0-e116-4be2-bb86-df8bb8ff749e	668ef837-2366-4adb-b085-9a29e0a667e2	17.00	high	2026-06-01 04:26:12.827116	2026-06-01 04:26:12.827116
87d5d363-4989-4037-8eab-cd2aff8b85c8	5dd773e0-e116-4be2-bb86-df8bb8ff749e	5c8d862f-beab-45d1-8da3-fa29f1545669	5.00	medium	2026-06-01 04:26:12.827116	2026-06-01 04:26:12.827116
9254c05d-b28d-4ade-8b0d-4c9d3d69fcaf	5dd773e0-e116-4be2-bb86-df8bb8ff749e	51aac523-ce6e-4371-9c9d-063c9f4581d2	2.00	low	2026-06-01 04:26:12.827116	2026-06-01 04:26:12.827116
f4e3f501-9ecd-475e-8d2a-a04b57122a55	5dd773e0-e116-4be2-bb86-df8bb8ff749e	b5df94c3-bd78-4de1-a5c5-be50e0e0f582	3.00	low	2026-06-01 04:26:12.827116	2026-06-01 04:26:12.827116
60007a04-9448-4f5b-a154-8f00890cf226	5dd773e0-e116-4be2-bb86-df8bb8ff749e	d269d4d8-ca34-46c6-8aa9-16b1263e8bc0	1.00	low	2026-06-01 04:26:12.827116	2026-06-01 04:26:12.827116
5afefa2a-e473-40f2-a372-42b4bef8154d	48dba40b-6b1f-4b70-86cf-5e73eadb7dbd	b5df94c3-bd78-4de1-a5c5-be50e0e0f582	8.00	medium	2026-06-01 04:26:12.85055	2026-06-01 04:26:12.85055
82c19387-29c5-40bf-a81b-ef73cd3572ef	48dba40b-6b1f-4b70-86cf-5e73eadb7dbd	d269d4d8-ca34-46c6-8aa9-16b1263e8bc0	5.00	medium	2026-06-01 04:26:12.85055	2026-06-01 04:26:12.85055
d0848aed-b48c-422e-8374-fb9416bb8318	48dba40b-6b1f-4b70-86cf-5e73eadb7dbd	668ef837-2366-4adb-b085-9a29e0a667e2	5.00	medium	2026-06-01 04:26:12.85055	2026-06-01 04:26:12.85055
d5ac976d-8bd9-4e8a-b599-93bf2de58d03	48dba40b-6b1f-4b70-86cf-5e73eadb7dbd	51274b3a-f2c6-457e-a6d0-b9f3b53d1a17	1.00	low	2026-06-01 04:26:12.85055	2026-06-01 04:26:12.85055
51ed364b-0094-4e49-a79e-6a54e040a1b2	b837e364-78fc-41c7-abad-760383338234	95a1ac1b-1ec5-43b6-8095-0a1a3809bca4	18.00	high	2026-06-01 04:35:40.714142	2026-06-01 04:35:40.714142
70e4f508-a4a1-4c9a-b8cd-6c0e4304175e	b837e364-78fc-41c7-abad-760383338234	51aac523-ce6e-4371-9c9d-063c9f4581d2	11.00	high	2026-06-01 04:35:40.714142	2026-06-01 04:35:40.714142
b968d171-48bb-4307-bf50-0d7017c0a861	b837e364-78fc-41c7-abad-760383338234	5c8d862f-beab-45d1-8da3-fa29f1545669	2.00	low	2026-06-01 04:35:40.714142	2026-06-01 04:35:40.714142
e83aa5b8-819b-4c4a-8b95-ad408b2ff058	b837e364-78fc-41c7-abad-760383338234	51274b3a-f2c6-457e-a6d0-b9f3b53d1a17	2.00	low	2026-06-01 04:35:40.714142	2026-06-01 04:35:40.714142
\.


--
-- Data for Name: external_certificates; Type: TABLE DATA; Schema: public; Owner: perfil_user
--

COPY public.external_certificates (id, student_profile_id, issuer, created_at, certificate_name, certificate_url, issue_date) FROM stdin;
65925ce1-0960-4e82-a183-b534a60da46f	b7908e30-ab2c-426d-a516-ca603de04350	freeCodeCamp	2026-06-01 04:26:12.348252	Certified JavaScript Developer	https://certificados.freecodecamp.org/b7908e30	2026-01-15
d2e5c63b-aae4-4391-b109-c179f0b6c371	324ed052-b5d5-43a9-b006-4221fbfedca2	Amazon Web Services	2026-06-01 04:26:12.35332	AWS Cloud Practitioner	https://certificados.amazonwebservices.org/324ed052	2026-02-15
77a0d715-fa0e-4dde-83bd-9e556e3bf4ab	50acf2c8-e09a-4937-b3be-57c3dfe036b2	Coursera	2026-06-01 04:26:12.357267	Python for Data Science	https://certificados.coursera.org/50acf2c8	2026-03-15
541529a9-a413-44e9-971a-96ce5100c363	b6d55a61-fea9-4f6e-8848-a3cd958d58eb	Scrum.org	2026-06-01 04:26:12.362365	Scrum Fundamentals Certified	https://certificados.scrumorg.org/b6d55a61	2026-04-15
f3a34c13-d963-4709-b8e2-64e8fa2247bb	b5619243-a8d8-473b-880e-2fd277e99056	Cisco Networking Academy	2026-06-01 04:26:12.367175	Cisco CCNA: Introduction to Networks	https://certificados.cisconetworkingacademy.org/b5619243	2026-05-15
f35aded5-2e36-453a-950b-79d7bd740510	04a62e3f-86d1-4611-8da2-9cc4f8fceb0f	Google	2026-06-01 04:26:12.37257	Fundamentos de UX	https://certificados.google.org/04a62e3f	2026-06-15
\.


--
-- Data for Name: internal_constancies; Type: TABLE DATA; Schema: public; Owner: perfil_user
--

COPY public.internal_constancies (id, student_profile_id, created_at, activity_id, activity_registration_id, description, status, authorized_by) FROM stdin;
f60b33be-a400-4d97-93eb-3d824d6a9b79	b837e364-78fc-41c7-abad-760383338234	2026-06-01 04:26:12.380522	79151de5-2aa2-482f-b5c6-3926287885d0	61261f13-aea3-4cb8-852c-eb59864e2592	Participación confirmada en Taller de Desarrollo Web.	authorized	036371dd-0abe-4a59-8c1a-5069fe5a43d3
62802d42-088d-4ee2-b445-3fbb372dd1e7	b7908e30-ab2c-426d-a516-ca603de04350	2026-06-01 04:26:12.387328	a9f169f2-148b-40a8-8200-933176296859	7e661a91-6801-444a-8fea-1767787abc9c	Participación confirmada en Seminario de Inteligencia Artificial.	authorized	036371dd-0abe-4a59-8c1a-5069fe5a43d3
efabafd8-1cbe-4a20-80c3-b881dbf2b629	fdbeb71b-7f93-454f-85b6-5f73771a2247	2026-06-01 04:26:12.392697	008d1a0c-e0f7-4fbc-a773-1f768bacfe96	dfd5a432-4500-45da-aca2-cd65998f21d3	Participación confirmada en Reto de Bases de Datos.	authorized	43aa4c25-f10a-42ee-a150-aa431014b218
cef8258f-5574-4c4a-98a1-a1763a42cbf1	324ed052-b5d5-43a9-b006-4221fbfedca2	2026-06-01 04:26:12.397916	d1eb23ea-cc60-4cbc-a400-6b403864d37a	e5c021a3-59f0-4366-8e13-df5cd3d65379	Participación confirmada en Clase espejo de Ingeniería de Software.	authorized	43aa4c25-f10a-42ee-a150-aa431014b218
\.


--
-- Data for Name: migrations; Type: TABLE DATA; Schema: public; Owner: perfil_user
--

COPY public.migrations (id, "timestamp", name) FROM stdin;
1	1780171623169	InitialSchema1780171623169
2	1780172000000	RenameRoleValues1780172000000
3	1780175301816	AddImprovementAreas1780175301816
4	1780175882779	AddActivityFields1780175882779
5	1780176772925	RefactorProjects1780176772925
6	1780177516870	RefactorEvidenceTables1780177516870
\.


--
-- Data for Name: project_evidences; Type: TABLE DATA; Schema: public; Owner: perfil_user
--

COPY public.project_evidences (id, project_id, created_at, evidence_type, description, file_url, external_url) FROM stdin;
fedf277b-9ec0-445c-be69-2ae250a372d7	ca4e496d-c1d5-4407-90cb-d77a3d35c73d	2026-06-01 04:26:12.279812	link	Repositorio	\N	https://github.com/univalle-isi/sistema-academico-web
691cfa4f-52cb-46d6-b870-244b78ae53fe	ca4e496d-c1d5-4407-90cb-d77a3d35c73d	2026-06-01 04:26:12.279812	link	Demostración	\N	https://isi.univalle.edu/proyectos/sistema-academico-web
d67c60b1-961b-44d1-913a-ecfef7c0fee6	c74e5cd2-ccdc-4db8-9f15-c3740ec18833	2026-06-01 04:26:12.289117	link	Repositorio	\N	https://github.com/univalle-isi/app-movil-de-seguimiento
c9060d3c-f71c-41bb-b7d9-4801bf2d9e29	c74e5cd2-ccdc-4db8-9f15-c3740ec18833	2026-06-01 04:26:12.289117	link	Demostración	\N	https://isi.univalle.edu/proyectos/app-movil-de-seguimiento
70b120bb-fbb0-4f2b-90df-299207ee5172	c7b69582-861d-40bd-be4c-bb116eb51c8d	2026-06-01 04:26:12.297227	link	Repositorio	\N	https://github.com/univalle-isi/dashboard-de-reportes
6d622319-dd2e-4fbb-82b0-73990ddbfba7	c7b69582-861d-40bd-be4c-bb116eb51c8d	2026-06-01 04:26:12.297227	link	Demostración	\N	https://isi.univalle.edu/proyectos/dashboard-de-reportes
e1df3875-b7d8-4978-88e5-3aff6bb5ff75	ee2d9105-aa86-475e-a1a7-db2613ea4eaf	2026-06-01 04:26:12.306373	link	Repositorio	\N	https://github.com/univalle-isi/api-de-gestion-de-proyectos
ac9f4efa-d2b5-4aac-8125-6d61afa2f42a	ee2d9105-aa86-475e-a1a7-db2613ea4eaf	2026-06-01 04:26:12.306373	link	Demostración	\N	https://isi.univalle.edu/proyectos/api-de-gestion-de-proyectos
8de85378-b3a0-454c-a3bf-e4e6c036e231	476bba52-8c33-4845-894c-d27219517eba	2026-06-01 04:26:12.316076	link	Repositorio	\N	https://github.com/univalle-isi/plataforma-de-tutorias
86b391e6-ea7f-4a75-bde1-e17a7d8a88ff	476bba52-8c33-4845-894c-d27219517eba	2026-06-01 04:26:12.316076	link	Demostración	\N	https://isi.univalle.edu/proyectos/plataforma-de-tutorias
8e0944d2-d07c-44d4-951a-1b6f5e418ff8	c297adb4-0b92-47ad-a215-ddcf5687eaf7	2026-06-01 04:26:12.324794	link	Repositorio	\N	https://github.com/univalle-isi/portal-de-evidencias-academicas
5f00218c-a10f-424d-80df-24bef95c4bf7	c297adb4-0b92-47ad-a215-ddcf5687eaf7	2026-06-01 04:26:12.324794	link	Demostración	\N	https://isi.univalle.edu/proyectos/portal-de-evidencias-academicas
d1f7f334-e146-4e3d-b49a-da3e48b7b1ca	2e059711-a237-478a-b7ba-74d71dd1b0db	2026-06-01 04:26:12.333027	link	Repositorio	\N	https://github.com/univalle-isi/visualizador-de-afinidades
7772c229-8374-417d-a1eb-3de58457b881	2e059711-a237-478a-b7ba-74d71dd1b0db	2026-06-01 04:26:12.333027	link	Demostración	\N	https://isi.univalle.edu/proyectos/visualizador-de-afinidades
fff4dddb-80c9-4f60-98d0-937cc31d7edd	7453efc4-896e-41d7-9d11-f3c699fca5d7	2026-06-01 04:26:12.342928	link	Repositorio	\N	https://github.com/univalle-isi/asistente-de-estudio-con-ia
4d8fe248-2800-40e8-a146-cc3ccc0b95dd	7453efc4-896e-41d7-9d11-f3c699fca5d7	2026-06-01 04:26:12.342928	link	Demostración	\N	https://isi.univalle.edu/proyectos/asistente-de-estudio-con-ia
\.


--
-- Data for Name: project_members; Type: TABLE DATA; Schema: public; Owner: perfil_user
--

COPY public.project_members (id, project_id, user_id, created_at, role, contribution) FROM stdin;
\.


--
-- Data for Name: projects; Type: TABLE DATA; Schema: public; Owner: perfil_user
--

COPY public.projects (id, title, description, status, technologies, academic_area_id, created_at, updated_at, created_by_profile_id, repository_url, demo_url) FROM stdin;
ca4e496d-c1d5-4407-90cb-d77a3d35c73d	Sistema académico web	Sistema académico web desarrollado como proyecto académico.	active	{React,NestJS,PostgreSQL}	95a1ac1b-1ec5-43b6-8095-0a1a3809bca4	2026-06-01 04:26:12.272075	2026-06-01 04:26:12.272075	b837e364-78fc-41c7-abad-760383338234	https://github.com/univalle-isi/sistema-academico-web	https://isi.univalle.edu/proyectos/sistema-academico-web
c74e5cd2-ccdc-4db8-9f15-c3740ec18833	App móvil de seguimiento	App móvil de seguimiento desarrollado como proyecto académico.	active	{"React Native",Expo}	d269d4d8-ca34-46c6-8aa9-16b1263e8bc0	2026-06-01 04:26:12.284906	2026-06-01 04:26:12.284906	fdbeb71b-7f93-454f-85b6-5f73771a2247	https://github.com/univalle-isi/app-movil-de-seguimiento	https://isi.univalle.edu/proyectos/app-movil-de-seguimiento
c7b69582-861d-40bd-be4c-bb116eb51c8d	Dashboard de reportes	Dashboard de reportes desarrollado como proyecto académico.	active	{React,PostgreSQL}	51274b3a-f2c6-457e-a6d0-b9f3b53d1a17	2026-06-01 04:26:12.293435	2026-06-01 04:26:12.293435	74661e76-0b41-4963-9533-8eefd11fc7fe	https://github.com/univalle-isi/dashboard-de-reportes	https://isi.univalle.edu/proyectos/dashboard-de-reportes
ee2d9105-aa86-475e-a1a7-db2613ea4eaf	API de gestión de proyectos	API de gestión de proyectos desarrollado como proyecto académico.	active	{NestJS,TypeScript}	668ef837-2366-4adb-b085-9a29e0a667e2	2026-06-01 04:26:12.301578	2026-06-01 04:26:12.301578	c43c385e-189d-4870-aa5b-e63c3cbda86d	https://github.com/univalle-isi/api-de-gestion-de-proyectos	https://isi.univalle.edu/proyectos/api-de-gestion-de-proyectos
476bba52-8c33-4845-894c-d27219517eba	Plataforma de tutorías	Plataforma de tutorías desarrollado como proyecto académico.	active	{React,Node.js}	95a1ac1b-1ec5-43b6-8095-0a1a3809bca4	2026-06-01 04:26:12.311552	2026-06-01 04:26:12.311552	868fed75-e7c6-4bfb-b557-1c75579bc204	https://github.com/univalle-isi/plataforma-de-tutorias	https://isi.univalle.edu/proyectos/plataforma-de-tutorias
c297adb4-0b92-47ad-a215-ddcf5687eaf7	Portal de evidencias académicas	Portal de evidencias académicas desarrollado como proyecto académico.	active	{Next.js,PostgreSQL}	d269d4d8-ca34-46c6-8aa9-16b1263e8bc0	2026-06-01 04:26:12.320379	2026-06-01 04:26:12.320379	00328739-b61c-4944-a520-73a039177ecd	https://github.com/univalle-isi/portal-de-evidencias-academicas	https://isi.univalle.edu/proyectos/portal-de-evidencias-academicas
2e059711-a237-478a-b7ba-74d71dd1b0db	Visualizador de afinidades	Visualizador de afinidades desarrollado como proyecto académico.	active	{React,D3.js}	51274b3a-f2c6-457e-a6d0-b9f3b53d1a17	2026-06-01 04:26:12.329186	2026-06-01 04:26:12.329186	6f2e5a45-c65f-4bc9-a550-6f84d71d997e	https://github.com/univalle-isi/visualizador-de-afinidades	https://isi.univalle.edu/proyectos/visualizador-de-afinidades
7453efc4-896e-41d7-9d11-f3c699fca5d7	Asistente de estudio con IA	Asistente de estudio con IA desarrollado como proyecto académico.	active	{Python,"Machine Learning"}	668ef837-2366-4adb-b085-9a29e0a667e2	2026-06-01 04:26:12.338541	2026-06-01 04:26:12.338541	5dd773e0-e116-4be2-bb86-df8bb8ff749e	https://github.com/univalle-isi/asistente-de-estudio-con-ia	https://isi.univalle.edu/proyectos/asistente-de-estudio-con-ia
\.


--
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: perfil_user
--

COPY public.roles (id, name, description, created_at, updated_at) FROM stdin;
bf111da7-fca9-425c-94f7-a20d6b522872	STUDENT	Construye su perfil estudiantil dinámico.	2026-06-01 04:26:11.28103	2026-06-01 04:26:11.28103
fddf887f-e7cd-4c60-ba1c-a59e0d257aaa	TEACHER	Publica actividades y confirma participación.	2026-06-01 04:26:11.298631	2026-06-01 04:26:11.298631
6a6f1d8e-8463-4a6d-9b4a-71192b07f877	CAREER_DIRECTOR	Consulta reportes generales y mapa de afinidad.	2026-06-01 04:26:11.307864	2026-06-01 04:26:11.307864
fe7b3ef4-6bfb-4e40-8c62-1ba7512936eb	SCIENTIFIC_SOCIETY	Publica actividades extracurriculares.	2026-06-01 04:26:11.315697	2026-06-01 04:26:11.315697
441a513a-bb01-44cb-82c1-ceab6b52f0d6	ADMIN	Gestiona usuarios, roles y catálogos.	2026-06-01 04:26:11.322819	2026-06-01 04:26:11.322819
\.


--
-- Data for Name: skills; Type: TABLE DATA; Schema: public; Owner: perfil_user
--

COPY public.skills (id, name, academic_area_id, created_at, updated_at) FROM stdin;
4af7c6e9-c171-40bb-8bc5-1475dca11d11	JavaScript	51aac523-ce6e-4371-9c9d-063c9f4581d2	2026-06-01 04:26:11.382035	2026-06-01 04:26:11.382035
a8bef291-ee4d-4017-bbeb-9c7b72c4b638	TypeScript	51aac523-ce6e-4371-9c9d-063c9f4581d2	2026-06-01 04:26:11.388113	2026-06-01 04:26:11.388113
6aa24095-3243-4446-9573-984d72c4ddcf	React	51aac523-ce6e-4371-9c9d-063c9f4581d2	2026-06-01 04:26:11.393125	2026-06-01 04:26:11.393125
b780630d-7d58-4e36-8a1a-e7a83ce4d187	Node.js	51aac523-ce6e-4371-9c9d-063c9f4581d2	2026-06-01 04:26:11.397364	2026-06-01 04:26:11.397364
f5fc795b-3e7e-417a-be62-1b25bca0e33b	HTML y CSS	51aac523-ce6e-4371-9c9d-063c9f4581d2	2026-06-01 04:26:11.401888	2026-06-01 04:26:11.401888
e212424c-a86f-43dc-b4ad-ed192be4610a	React Native	d269d4d8-ca34-46c6-8aa9-16b1263e8bc0	2026-06-01 04:26:11.406754	2026-06-01 04:26:11.406754
ff4b5d12-22e8-4220-86a5-743b01c99fb2	Flutter	d269d4d8-ca34-46c6-8aa9-16b1263e8bc0	2026-06-01 04:26:11.410747	2026-06-01 04:26:11.410747
ae2631d6-b95c-4e18-8fd2-c2a30a71f5b4	Kotlin	d269d4d8-ca34-46c6-8aa9-16b1263e8bc0	2026-06-01 04:26:11.414828	2026-06-01 04:26:11.414828
9705ab81-f11f-4d00-bc08-b434e4e39df3	Python	668ef837-2366-4adb-b085-9a29e0a667e2	2026-06-01 04:26:11.420117	2026-06-01 04:26:11.420117
c04b1c4b-623b-49a8-8517-267b473be44b	Machine Learning	668ef837-2366-4adb-b085-9a29e0a667e2	2026-06-01 04:26:11.424109	2026-06-01 04:26:11.424109
a66b3578-c60c-4874-8407-824e3b4ad73f	Redes Neuronales	668ef837-2366-4adb-b085-9a29e0a667e2	2026-06-01 04:26:11.427671	2026-06-01 04:26:11.427671
83c0e331-6d7e-4863-a4c9-5ad354596d25	SQL	95a1ac1b-1ec5-43b6-8095-0a1a3809bca4	2026-06-01 04:26:11.432845	2026-06-01 04:26:11.432845
ce4acde9-aa02-4df9-81f9-8f470402a391	PostgreSQL	95a1ac1b-1ec5-43b6-8095-0a1a3809bca4	2026-06-01 04:26:11.436581	2026-06-01 04:26:11.436581
67d7f507-f329-49f6-a965-26206ec4d39f	MongoDB	95a1ac1b-1ec5-43b6-8095-0a1a3809bca4	2026-06-01 04:26:11.440417	2026-06-01 04:26:11.440417
64bd198b-c405-42a9-afdc-6d9388cd97fc	TCP/IP	b5df94c3-bd78-4de1-a5c5-be50e0e0f582	2026-06-01 04:26:11.446019	2026-06-01 04:26:11.446019
2242c454-1b1e-43d0-907f-4afe8cabadcd	Routing	b5df94c3-bd78-4de1-a5c5-be50e0e0f582	2026-06-01 04:26:11.450632	2026-06-01 04:26:11.450632
0a58df9c-4f83-45a5-bed5-04b4a613acf7	Administración Linux	b5df94c3-bd78-4de1-a5c5-be50e0e0f582	2026-06-01 04:26:11.454529	2026-06-01 04:26:11.454529
862c183c-103e-408a-9130-a7f86a1e8708	Pentesting	5c8d862f-beab-45d1-8da3-fa29f1545669	2026-06-01 04:26:11.459663	2026-06-01 04:26:11.459663
3d36b0e7-fc17-4f75-bcb6-75901df3e908	Criptografía	5c8d862f-beab-45d1-8da3-fa29f1545669	2026-06-01 04:26:11.463677	2026-06-01 04:26:11.463677
b9bb2996-bb68-4dd9-be81-43eb9b667664	Análisis de Vulnerabilidades	5c8d862f-beab-45d1-8da3-fa29f1545669	2026-06-01 04:26:11.467811	2026-06-01 04:26:11.467811
70252234-4508-4eff-815d-ebd0423a94fb	UML	2a50651b-4a46-48b1-8289-bf1b39813f17	2026-06-01 04:26:11.472877	2026-06-01 04:26:11.472877
d83b234f-ef99-481f-87da-dee60f7bbe07	Patrones de Diseño	2a50651b-4a46-48b1-8289-bf1b39813f17	2026-06-01 04:26:11.476819	2026-06-01 04:26:11.476819
edaa7085-e28b-4e45-af3b-ce9bee92ad48	Testing	2a50651b-4a46-48b1-8289-bf1b39813f17	2026-06-01 04:26:11.480626	2026-06-01 04:26:11.480626
80be0271-3b49-4996-bfd0-be2f268a186b	Git	2a50651b-4a46-48b1-8289-bf1b39813f17	2026-06-01 04:26:11.484477	2026-06-01 04:26:11.484477
fc8811ce-9c5a-4ea8-af14-cd922539ec2e	Scrum	51274b3a-f2c6-457e-a6d0-b9f3b53d1a17	2026-06-01 04:26:11.489165	2026-06-01 04:26:11.489165
1408ad31-a0a5-45b6-9a46-4b519146dab4	Kanban	51274b3a-f2c6-457e-a6d0-b9f3b53d1a17	2026-06-01 04:26:11.492707	2026-06-01 04:26:11.492707
3130653c-b677-4095-b4b4-6334d152b72b	Liderazgo	51274b3a-f2c6-457e-a6d0-b9f3b53d1a17	2026-06-01 04:26:11.49655	2026-06-01 04:26:11.49655
\.


--
-- Data for Name: student_interests; Type: TABLE DATA; Schema: public; Owner: perfil_user
--

COPY public.student_interests (id, student_profile_id, academic_area_id, priority, created_at, updated_at) FROM stdin;
48286ce4-3eaa-4adc-9bd9-6261a5a37712	b837e364-78fc-41c7-abad-760383338234	95a1ac1b-1ec5-43b6-8095-0a1a3809bca4	5	2026-06-01 04:26:11.731082	2026-06-01 04:26:11.731082
8e867c41-3c90-4557-810e-dacad32108d7	b837e364-78fc-41c7-abad-760383338234	51aac523-ce6e-4371-9c9d-063c9f4581d2	3	2026-06-01 04:26:11.731082	2026-06-01 04:26:11.731082
1f91f661-1b54-49ce-8529-23928b673caa	b7908e30-ab2c-426d-a516-ca603de04350	5c8d862f-beab-45d1-8da3-fa29f1545669	5	2026-06-01 04:26:11.756091	2026-06-01 04:26:11.756091
a692caec-624a-4b5a-b636-3f691ed5e509	b7908e30-ab2c-426d-a516-ca603de04350	51274b3a-f2c6-457e-a6d0-b9f3b53d1a17	3	2026-06-01 04:26:11.756091	2026-06-01 04:26:11.756091
2f013ee9-101d-49c9-ad31-efed1d91a6a1	fdbeb71b-7f93-454f-85b6-5f73771a2247	d269d4d8-ca34-46c6-8aa9-16b1263e8bc0	5	2026-06-01 04:26:11.777252	2026-06-01 04:26:11.777252
2edec4f0-12cd-4c6e-a280-5227228501d7	fdbeb71b-7f93-454f-85b6-5f73771a2247	2a50651b-4a46-48b1-8289-bf1b39813f17	3	2026-06-01 04:26:11.777252	2026-06-01 04:26:11.777252
e5b8aa58-eaa8-4363-8abd-e3a5a4228a71	324ed052-b5d5-43a9-b006-4221fbfedca2	51aac523-ce6e-4371-9c9d-063c9f4581d2	5	2026-06-01 04:26:11.796709	2026-06-01 04:26:11.796709
78cb02f5-3cac-496c-a7aa-84b31d3004b1	324ed052-b5d5-43a9-b006-4221fbfedca2	668ef837-2366-4adb-b085-9a29e0a667e2	3	2026-06-01 04:26:11.796709	2026-06-01 04:26:11.796709
e2b0a64b-efa2-46e6-abf7-f9cd51d1167b	74661e76-0b41-4963-9533-8eefd11fc7fe	51274b3a-f2c6-457e-a6d0-b9f3b53d1a17	5	2026-06-01 04:26:11.818603	2026-06-01 04:26:11.818603
a2588afe-a9ca-4a63-be3a-078eb47d6809	74661e76-0b41-4963-9533-8eefd11fc7fe	b5df94c3-bd78-4de1-a5c5-be50e0e0f582	3	2026-06-01 04:26:11.818603	2026-06-01 04:26:11.818603
308ae1a4-673d-4b68-930a-42c92d5a90b3	50acf2c8-e09a-4937-b3be-57c3dfe036b2	2a50651b-4a46-48b1-8289-bf1b39813f17	5	2026-06-01 04:26:11.837805	2026-06-01 04:26:11.837805
e83246c1-a52c-46e2-af36-91b4f66cfb86	50acf2c8-e09a-4937-b3be-57c3dfe036b2	95a1ac1b-1ec5-43b6-8095-0a1a3809bca4	3	2026-06-01 04:26:11.837805	2026-06-01 04:26:11.837805
f729dfb8-dccc-4a03-beff-c50877cfa38a	c43c385e-189d-4870-aa5b-e63c3cbda86d	668ef837-2366-4adb-b085-9a29e0a667e2	5	2026-06-01 04:26:11.855123	2026-06-01 04:26:11.855123
ba3a81f7-cd88-44d3-b33e-10a7907e4d5f	c43c385e-189d-4870-aa5b-e63c3cbda86d	5c8d862f-beab-45d1-8da3-fa29f1545669	3	2026-06-01 04:26:11.855123	2026-06-01 04:26:11.855123
6c3f9c91-2ffc-40d7-848d-e6d8f1c28a48	b6d55a61-fea9-4f6e-8848-a3cd958d58eb	b5df94c3-bd78-4de1-a5c5-be50e0e0f582	5	2026-06-01 04:26:11.872997	2026-06-01 04:26:11.872997
b2ffa214-aa20-4c2d-9b89-5f1913715ee6	b6d55a61-fea9-4f6e-8848-a3cd958d58eb	d269d4d8-ca34-46c6-8aa9-16b1263e8bc0	3	2026-06-01 04:26:11.872997	2026-06-01 04:26:11.872997
f2766d21-1f88-47a8-ae7e-515274df8fbd	868fed75-e7c6-4bfb-b557-1c75579bc204	95a1ac1b-1ec5-43b6-8095-0a1a3809bca4	5	2026-06-01 04:26:11.890725	2026-06-01 04:26:11.890725
d3c93eb8-9293-4c95-9103-b38c1a05b912	868fed75-e7c6-4bfb-b557-1c75579bc204	51aac523-ce6e-4371-9c9d-063c9f4581d2	3	2026-06-01 04:26:11.890725	2026-06-01 04:26:11.890725
51a243d6-6c90-4308-b7a4-7d3dbbe0e771	b5619243-a8d8-473b-880e-2fd277e99056	5c8d862f-beab-45d1-8da3-fa29f1545669	5	2026-06-01 04:26:11.909596	2026-06-01 04:26:11.909596
ff177e0c-1336-45fe-8e63-485f506fa80b	b5619243-a8d8-473b-880e-2fd277e99056	51274b3a-f2c6-457e-a6d0-b9f3b53d1a17	3	2026-06-01 04:26:11.909596	2026-06-01 04:26:11.909596
e3762f11-3ddb-48ff-939c-56ad47ece46b	00328739-b61c-4944-a520-73a039177ecd	d269d4d8-ca34-46c6-8aa9-16b1263e8bc0	5	2026-06-01 04:26:11.927111	2026-06-01 04:26:11.927111
8e1cb578-f889-44ac-a768-d3f26020c501	00328739-b61c-4944-a520-73a039177ecd	2a50651b-4a46-48b1-8289-bf1b39813f17	3	2026-06-01 04:26:11.927111	2026-06-01 04:26:11.927111
9dd76280-d462-47c0-a0f0-8efc515993e1	04a62e3f-86d1-4611-8da2-9cc4f8fceb0f	51aac523-ce6e-4371-9c9d-063c9f4581d2	5	2026-06-01 04:26:11.944986	2026-06-01 04:26:11.944986
43c2e7e3-f207-4da0-8686-6c7fe7eaf0cc	04a62e3f-86d1-4611-8da2-9cc4f8fceb0f	668ef837-2366-4adb-b085-9a29e0a667e2	3	2026-06-01 04:26:11.944986	2026-06-01 04:26:11.944986
9b72f702-da5f-458a-a7ea-912672cfd50d	6f2e5a45-c65f-4bc9-a550-6f84d71d997e	51274b3a-f2c6-457e-a6d0-b9f3b53d1a17	5	2026-06-01 04:26:11.961379	2026-06-01 04:26:11.961379
fc04a1fc-d959-425f-ba83-d89ca019f8a9	6f2e5a45-c65f-4bc9-a550-6f84d71d997e	b5df94c3-bd78-4de1-a5c5-be50e0e0f582	3	2026-06-01 04:26:11.961379	2026-06-01 04:26:11.961379
65f589a2-ae8f-4d2b-9b76-974763c87eff	de92a500-0f51-4e3b-9895-9d90b1280bda	2a50651b-4a46-48b1-8289-bf1b39813f17	5	2026-06-01 04:26:11.976641	2026-06-01 04:26:11.976641
80f3863b-24d2-47fc-8f0c-e134bc35334f	de92a500-0f51-4e3b-9895-9d90b1280bda	95a1ac1b-1ec5-43b6-8095-0a1a3809bca4	3	2026-06-01 04:26:11.976641	2026-06-01 04:26:11.976641
b1bd9b31-339f-43b7-b796-92b5f1673f08	5dd773e0-e116-4be2-bb86-df8bb8ff749e	668ef837-2366-4adb-b085-9a29e0a667e2	5	2026-06-01 04:26:11.994631	2026-06-01 04:26:11.994631
e6ae117b-6246-4a37-8b43-ec61b6a945a6	5dd773e0-e116-4be2-bb86-df8bb8ff749e	5c8d862f-beab-45d1-8da3-fa29f1545669	3	2026-06-01 04:26:11.994631	2026-06-01 04:26:11.994631
542f43ee-65ca-45c8-b814-6ad73d7f22b9	48dba40b-6b1f-4b70-86cf-5e73eadb7dbd	b5df94c3-bd78-4de1-a5c5-be50e0e0f582	5	2026-06-01 04:26:12.01286	2026-06-01 04:26:12.01286
b5fab5f7-e4b5-45b5-8a44-a41fb1e5cb9d	48dba40b-6b1f-4b70-86cf-5e73eadb7dbd	d269d4d8-ca34-46c6-8aa9-16b1263e8bc0	3	2026-06-01 04:26:12.01286	2026-06-01 04:26:12.01286
\.


--
-- Data for Name: student_profiles; Type: TABLE DATA; Schema: public; Owner: perfil_user
--

COPY public.student_profiles (id, user_id, university_code, semester, bio, status, completion_percentage, created_at, updated_at, improvement_area_ids) FROM stdin;
b837e364-78fc-41c7-abad-760383338234	3e89487d-5ac6-4918-a2f6-285158e42685	\N	1	Estudiante de Ingeniería en Sistemas con interés en bases de datos.	active	100	2026-06-01 04:26:11.723215	2026-06-01 04:26:12.425567	{51aac523-ce6e-4371-9c9d-063c9f4581d2}
b7908e30-ab2c-426d-a516-ca603de04350	3474ac2c-5bb1-4b32-811e-3b9be56f426a	\N	2	Estudiante de Ingeniería en Sistemas con interés en ciberseguridad.	active	100	2026-06-01 04:26:11.750011	2026-06-01 04:26:12.472926	{51274b3a-f2c6-457e-a6d0-b9f3b53d1a17}
fdbeb71b-7f93-454f-85b6-5f73771a2247	529eb732-ae96-4c20-b40c-9bea7241b280	\N	3	Estudiante de Ingeniería en Sistemas con interés en desarrollo móvil.	active	100	2026-06-01 04:26:11.772829	2026-06-01 04:26:12.505749	{2a50651b-4a46-48b1-8289-bf1b39813f17}
324ed052-b5d5-43a9-b006-4221fbfedca2	76846bf5-b493-4dcb-90db-e7979ae57232	\N	4	Estudiante de Ingeniería en Sistemas con interés en desarrollo web.	active	100	2026-06-01 04:26:11.792746	2026-06-01 04:26:12.536006	{668ef837-2366-4adb-b085-9a29e0a667e2}
74661e76-0b41-4963-9533-8eefd11fc7fe	0e1d8f1d-7ab4-4c9a-ac0f-8243cda50648	\N	5	Estudiante de Ingeniería en Sistemas con interés en gestión de proyectos.	active	100	2026-06-01 04:26:11.812446	2026-06-01 04:26:12.564128	{b5df94c3-bd78-4de1-a5c5-be50e0e0f582}
50acf2c8-e09a-4937-b3be-57c3dfe036b2	e3bc45fe-91ca-4568-921a-f0b1e23a0af0	\N	6	Estudiante de Ingeniería en Sistemas con interés en ingeniería de software.	active	100	2026-06-01 04:26:11.833839	2026-06-01 04:26:12.589419	{95a1ac1b-1ec5-43b6-8095-0a1a3809bca4}
c43c385e-189d-4870-aa5b-e63c3cbda86d	0c0b4baf-316a-42a7-be37-362d4cd83d7d	\N	7	Estudiante de Ingeniería en Sistemas con interés en inteligencia artificial.	active	100	2026-06-01 04:26:11.851241	2026-06-01 04:26:12.613405	{5c8d862f-beab-45d1-8da3-fa29f1545669}
b6d55a61-fea9-4f6e-8848-a3cd958d58eb	b08b993e-34ed-45fa-bf0c-706672652755	\N	8	Estudiante de Ingeniería en Sistemas con interés en redes.	active	100	2026-06-01 04:26:11.868443	2026-06-01 04:26:12.639235	{d269d4d8-ca34-46c6-8aa9-16b1263e8bc0}
868fed75-e7c6-4bfb-b557-1c75579bc204	df18a8de-598a-48e0-a879-2497ff05fef9	\N	1	Estudiante de Ingeniería en Sistemas con interés en bases de datos.	active	100	2026-06-01 04:26:11.886383	2026-06-01 04:26:12.664491	{51aac523-ce6e-4371-9c9d-063c9f4581d2}
b5619243-a8d8-473b-880e-2fd277e99056	7416abd0-6bc6-464a-b75e-e07e3bab2a7d	\N	2	Estudiante de Ingeniería en Sistemas con interés en ciberseguridad.	active	100	2026-06-01 04:26:11.904754	2026-06-01 04:26:12.690922	{51274b3a-f2c6-457e-a6d0-b9f3b53d1a17}
00328739-b61c-4944-a520-73a039177ecd	dc37815d-f14f-42c3-bd2d-56fcc40fd921	\N	3	Estudiante de Ingeniería en Sistemas con interés en desarrollo móvil.	active	100	2026-06-01 04:26:11.923218	2026-06-01 04:26:12.714021	{2a50651b-4a46-48b1-8289-bf1b39813f17}
04a62e3f-86d1-4611-8da2-9cc4f8fceb0f	29dd6a8a-c818-40b7-a266-a8a6e4e252bf	\N	4	Estudiante de Ingeniería en Sistemas con interés en desarrollo web.	active	100	2026-06-01 04:26:11.940828	2026-06-01 04:26:12.740334	{668ef837-2366-4adb-b085-9a29e0a667e2}
6f2e5a45-c65f-4bc9-a550-6f84d71d997e	da993a24-7b36-4de0-9883-771bbb121c9d	\N	5	Estudiante de Ingeniería en Sistemas con interés en gestión de proyectos.	active	100	2026-06-01 04:26:11.957469	2026-06-01 04:26:12.762452	{b5df94c3-bd78-4de1-a5c5-be50e0e0f582}
de92a500-0f51-4e3b-9895-9d90b1280bda	05c7f993-ca3e-4c4a-8b19-bbcf68f121f7	\N	6	Estudiante de Ingeniería en Sistemas con interés en ingeniería de software.	active	100	2026-06-01 04:26:11.972989	2026-06-01 04:26:12.789126	{95a1ac1b-1ec5-43b6-8095-0a1a3809bca4}
5dd773e0-e116-4be2-bb86-df8bb8ff749e	bff5a095-babd-4674-8bb6-2653221187dc	\N	7	Estudiante de Ingeniería en Sistemas con interés en inteligencia artificial.	active	100	2026-06-01 04:26:11.990319	2026-06-01 04:26:12.811805	{5c8d862f-beab-45d1-8da3-fa29f1545669}
48dba40b-6b1f-4b70-86cf-5e73eadb7dbd	d8e4922c-7e95-4e03-9dbc-08b0ff8815a9	\N	8	Estudiante de Ingeniería en Sistemas con interés en redes.	active	100	2026-06-01 04:26:12.008663	2026-06-01 04:26:12.836609	{d269d4d8-ca34-46c6-8aa9-16b1263e8bc0}
\.


--
-- Data for Name: student_skills; Type: TABLE DATA; Schema: public; Owner: perfil_user
--

COPY public.student_skills (id, student_profile_id, skill_id, level, created_at, updated_at) FROM stdin;
c583219e-dad7-418d-a4e7-fcf4249dd916	b837e364-78fc-41c7-abad-760383338234	ce4acde9-aa02-4df9-81f9-8f470402a391	5	2026-06-01 04:26:11.73868	2026-06-01 04:26:11.73868
8b78b494-cf63-4bbc-9298-b346ad5d947c	b837e364-78fc-41c7-abad-760383338234	83c0e331-6d7e-4863-a4c9-5ad354596d25	4	2026-06-01 04:26:11.73868	2026-06-01 04:26:11.73868
fc30a45c-1478-42ed-bce0-13a4e2f76a29	b837e364-78fc-41c7-abad-760383338234	6aa24095-3243-4446-9573-984d72c4ddcf	3	2026-06-01 04:26:11.73868	2026-06-01 04:26:11.73868
2e9e54ae-2c29-48a0-9bf0-f374097e7cdb	b7908e30-ab2c-426d-a516-ca603de04350	862c183c-103e-408a-9130-a7f86a1e8708	5	2026-06-01 04:26:11.761203	2026-06-01 04:26:11.761203
762c8395-58b1-43c0-8d37-f0920a917c8c	b7908e30-ab2c-426d-a516-ca603de04350	3d36b0e7-fc17-4f75-bcb6-75901df3e908	4	2026-06-01 04:26:11.761203	2026-06-01 04:26:11.761203
d43ee0c9-ae48-4436-869e-22219d4de38d	b7908e30-ab2c-426d-a516-ca603de04350	fc8811ce-9c5a-4ea8-af14-cd922539ec2e	3	2026-06-01 04:26:11.761203	2026-06-01 04:26:11.761203
e2e733f3-518d-4026-a7ef-650ca85696f8	fdbeb71b-7f93-454f-85b6-5f73771a2247	e212424c-a86f-43dc-b4ad-ed192be4610a	5	2026-06-01 04:26:11.782615	2026-06-01 04:26:11.782615
a259144b-608b-4203-ad68-cf91161b07b0	fdbeb71b-7f93-454f-85b6-5f73771a2247	ff4b5d12-22e8-4220-86a5-743b01c99fb2	4	2026-06-01 04:26:11.782615	2026-06-01 04:26:11.782615
387c6068-d9a6-41a4-878c-39ec3a9bf039	fdbeb71b-7f93-454f-85b6-5f73771a2247	70252234-4508-4eff-815d-ebd0423a94fb	3	2026-06-01 04:26:11.782615	2026-06-01 04:26:11.782615
4066b141-66af-456b-8e74-75a58784f7e7	324ed052-b5d5-43a9-b006-4221fbfedca2	6aa24095-3243-4446-9573-984d72c4ddcf	5	2026-06-01 04:26:11.801469	2026-06-01 04:26:11.801469
e325588f-54c3-46f6-8191-1075037a0ca4	324ed052-b5d5-43a9-b006-4221fbfedca2	9705ab81-f11f-4d00-bc08-b434e4e39df3	4	2026-06-01 04:26:11.801469	2026-06-01 04:26:11.801469
66837b42-5f88-459b-b99c-2cf3749bede1	74661e76-0b41-4963-9533-8eefd11fc7fe	fc8811ce-9c5a-4ea8-af14-cd922539ec2e	5	2026-06-01 04:26:11.823607	2026-06-01 04:26:11.823607
85a77c09-64d6-43fd-a471-d818f23c52f0	74661e76-0b41-4963-9533-8eefd11fc7fe	1408ad31-a0a5-45b6-9a46-4b519146dab4	4	2026-06-01 04:26:11.823607	2026-06-01 04:26:11.823607
dba4230f-ee04-489f-9e3c-9558136c85c7	74661e76-0b41-4963-9533-8eefd11fc7fe	64bd198b-c405-42a9-afdc-6d9388cd97fc	3	2026-06-01 04:26:11.823607	2026-06-01 04:26:11.823607
f66d4bb8-c4be-48e1-9f14-69ed5c7fa124	50acf2c8-e09a-4937-b3be-57c3dfe036b2	70252234-4508-4eff-815d-ebd0423a94fb	5	2026-06-01 04:26:11.841791	2026-06-01 04:26:11.841791
a9f2f820-e66c-4f59-9794-a626255bf89e	50acf2c8-e09a-4937-b3be-57c3dfe036b2	d83b234f-ef99-481f-87da-dee60f7bbe07	4	2026-06-01 04:26:11.841791	2026-06-01 04:26:11.841791
f428dd6d-da1c-4d1e-a3bf-44bf6365781d	50acf2c8-e09a-4937-b3be-57c3dfe036b2	ce4acde9-aa02-4df9-81f9-8f470402a391	3	2026-06-01 04:26:11.841791	2026-06-01 04:26:11.841791
45db6baf-83f9-43ac-85ba-69be521bd410	c43c385e-189d-4870-aa5b-e63c3cbda86d	9705ab81-f11f-4d00-bc08-b434e4e39df3	5	2026-06-01 04:26:11.859366	2026-06-01 04:26:11.859366
263e475c-55bd-491c-89cd-60d1d2ed6184	c43c385e-189d-4870-aa5b-e63c3cbda86d	c04b1c4b-623b-49a8-8517-267b473be44b	4	2026-06-01 04:26:11.859366	2026-06-01 04:26:11.859366
802096f2-1c9a-4214-98bd-46e9cbce04a9	c43c385e-189d-4870-aa5b-e63c3cbda86d	862c183c-103e-408a-9130-a7f86a1e8708	3	2026-06-01 04:26:11.859366	2026-06-01 04:26:11.859366
3d7fe907-d179-4f7b-9dd4-25e029a56bdc	b6d55a61-fea9-4f6e-8848-a3cd958d58eb	64bd198b-c405-42a9-afdc-6d9388cd97fc	5	2026-06-01 04:26:11.876887	2026-06-01 04:26:11.876887
0f8174a7-2a97-4eeb-b809-b3fce653a2b9	b6d55a61-fea9-4f6e-8848-a3cd958d58eb	2242c454-1b1e-43d0-907f-4afe8cabadcd	4	2026-06-01 04:26:11.876887	2026-06-01 04:26:11.876887
0938eaa0-baad-4d38-ba6c-0c355a5c336c	b6d55a61-fea9-4f6e-8848-a3cd958d58eb	e212424c-a86f-43dc-b4ad-ed192be4610a	3	2026-06-01 04:26:11.876887	2026-06-01 04:26:11.876887
13c6e1e7-c3b6-4f37-9d21-fdd3642f74e8	868fed75-e7c6-4bfb-b557-1c75579bc204	ce4acde9-aa02-4df9-81f9-8f470402a391	5	2026-06-01 04:26:11.895275	2026-06-01 04:26:11.895275
fcebaa37-330b-4217-80f0-dbceb1d43344	868fed75-e7c6-4bfb-b557-1c75579bc204	83c0e331-6d7e-4863-a4c9-5ad354596d25	4	2026-06-01 04:26:11.895275	2026-06-01 04:26:11.895275
c9fb1096-a071-479c-9133-ef9e0d03722d	868fed75-e7c6-4bfb-b557-1c75579bc204	6aa24095-3243-4446-9573-984d72c4ddcf	3	2026-06-01 04:26:11.895275	2026-06-01 04:26:11.895275
ac8318a8-2a68-4b2e-8e9d-be0451490217	b5619243-a8d8-473b-880e-2fd277e99056	862c183c-103e-408a-9130-a7f86a1e8708	5	2026-06-01 04:26:11.914234	2026-06-01 04:26:11.914234
92394367-adcf-4d0c-862d-9e7c1eb9655a	b5619243-a8d8-473b-880e-2fd277e99056	3d36b0e7-fc17-4f75-bcb6-75901df3e908	4	2026-06-01 04:26:11.914234	2026-06-01 04:26:11.914234
d8aeceee-4067-4cea-85d3-ced89d297619	b5619243-a8d8-473b-880e-2fd277e99056	fc8811ce-9c5a-4ea8-af14-cd922539ec2e	3	2026-06-01 04:26:11.914234	2026-06-01 04:26:11.914234
1b3ee58f-144d-4e2d-8a85-4431206b81b3	00328739-b61c-4944-a520-73a039177ecd	e212424c-a86f-43dc-b4ad-ed192be4610a	5	2026-06-01 04:26:11.931309	2026-06-01 04:26:11.931309
35df808f-7841-4edc-85a0-3f8bc185bb6d	00328739-b61c-4944-a520-73a039177ecd	ff4b5d12-22e8-4220-86a5-743b01c99fb2	4	2026-06-01 04:26:11.931309	2026-06-01 04:26:11.931309
b5d1ddf3-9887-4f6f-b2be-a53ea9ca2443	00328739-b61c-4944-a520-73a039177ecd	70252234-4508-4eff-815d-ebd0423a94fb	3	2026-06-01 04:26:11.931309	2026-06-01 04:26:11.931309
3249d260-2187-46b7-9950-335d6933836f	04a62e3f-86d1-4611-8da2-9cc4f8fceb0f	6aa24095-3243-4446-9573-984d72c4ddcf	5	2026-06-01 04:26:11.949067	2026-06-01 04:26:11.949067
dc19956f-18be-4c66-a09b-1b97883803d8	04a62e3f-86d1-4611-8da2-9cc4f8fceb0f	9705ab81-f11f-4d00-bc08-b434e4e39df3	4	2026-06-01 04:26:11.949067	2026-06-01 04:26:11.949067
2ac81f31-0b62-4f38-828b-1739f372941b	6f2e5a45-c65f-4bc9-a550-6f84d71d997e	fc8811ce-9c5a-4ea8-af14-cd922539ec2e	5	2026-06-01 04:26:11.965146	2026-06-01 04:26:11.965146
fb836523-2270-4673-856a-a4219ec6d4fe	6f2e5a45-c65f-4bc9-a550-6f84d71d997e	1408ad31-a0a5-45b6-9a46-4b519146dab4	4	2026-06-01 04:26:11.965146	2026-06-01 04:26:11.965146
7599e504-16d5-4bf9-8fdc-c4b10c5f3c31	6f2e5a45-c65f-4bc9-a550-6f84d71d997e	64bd198b-c405-42a9-afdc-6d9388cd97fc	3	2026-06-01 04:26:11.965146	2026-06-01 04:26:11.965146
e3baed27-c696-4d48-963c-b5ae9482a5a3	de92a500-0f51-4e3b-9895-9d90b1280bda	70252234-4508-4eff-815d-ebd0423a94fb	5	2026-06-01 04:26:11.981234	2026-06-01 04:26:11.981234
830a4548-001a-4fa2-a4cd-437b09ffbbf4	de92a500-0f51-4e3b-9895-9d90b1280bda	d83b234f-ef99-481f-87da-dee60f7bbe07	4	2026-06-01 04:26:11.981234	2026-06-01 04:26:11.981234
aa93d79f-0173-4c94-84c0-62d5aa2494f4	de92a500-0f51-4e3b-9895-9d90b1280bda	ce4acde9-aa02-4df9-81f9-8f470402a391	3	2026-06-01 04:26:11.981234	2026-06-01 04:26:11.981234
7178b819-3a8d-4490-8165-fe658f93b40b	5dd773e0-e116-4be2-bb86-df8bb8ff749e	9705ab81-f11f-4d00-bc08-b434e4e39df3	5	2026-06-01 04:26:11.999141	2026-06-01 04:26:11.999141
cb368b71-63cf-41f2-beaa-e5fced56d04d	5dd773e0-e116-4be2-bb86-df8bb8ff749e	c04b1c4b-623b-49a8-8517-267b473be44b	4	2026-06-01 04:26:11.999141	2026-06-01 04:26:11.999141
0e6b05be-1f46-4a0e-848f-afd8067476db	5dd773e0-e116-4be2-bb86-df8bb8ff749e	862c183c-103e-408a-9130-a7f86a1e8708	3	2026-06-01 04:26:11.999141	2026-06-01 04:26:11.999141
c132ed15-2a9c-43aa-bbe7-9b6a7f3e5a23	48dba40b-6b1f-4b70-86cf-5e73eadb7dbd	64bd198b-c405-42a9-afdc-6d9388cd97fc	5	2026-06-01 04:26:12.017026	2026-06-01 04:26:12.017026
8b218617-33c1-44e1-a9cb-ee50607b85cd	48dba40b-6b1f-4b70-86cf-5e73eadb7dbd	2242c454-1b1e-43d0-907f-4afe8cabadcd	4	2026-06-01 04:26:12.017026	2026-06-01 04:26:12.017026
faaaaf24-2db0-4035-bec4-a6400e64cf4c	48dba40b-6b1f-4b70-86cf-5e73eadb7dbd	e212424c-a86f-43dc-b4ad-ed192be4610a	3	2026-06-01 04:26:12.017026	2026-06-01 04:26:12.017026
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: perfil_user
--

COPY public.users (id, email, password_hash, first_name, last_name, status, role_id, created_at, updated_at) FROM stdin;
e0b928e0-86c4-4b47-b676-c5af1b66134b	admin@univalle.edu	$2a$10$oYqJGAzk6vAedWdMSG0rEu2uhswtLwok6SiLgGBKybPcbx5DCKYWm	Administrador	Sistema	active	441a513a-bb01-44cb-82c1-ceab6b52f0d6	2026-06-01 04:26:11.590977	2026-06-01 04:26:11.590977
43aa4c25-f10a-42ee-a150-aa431014b218	maria.gutierrez@univalle.edu	$2a$10$xQ5MdzaQ64FAz9Mh3yf74uVdLxBy/6eOw7gHaREHf33Wn.usPvFiO	María	Gutiérrez	active	fddf887f-e7cd-4c60-ba1c-a59e0d257aaa	2026-06-01 04:26:11.692856	2026-06-01 04:26:11.692856
e7c9c743-5662-47de-9cfd-95207d24fa39	jorge.vargas@univalle.edu	$2a$10$xQ5MdzaQ64FAz9Mh3yf74uVdLxBy/6eOw7gHaREHf33Wn.usPvFiO	Jorge	Vargas	active	6a6f1d8e-8463-4a6d-9b4a-71192b07f877	2026-06-01 04:26:11.701199	2026-06-01 04:26:11.701199
88674fd8-2ac8-4419-81dd-2264288047ab	lucia.fernandez@univalle.edu	$2a$10$xQ5MdzaQ64FAz9Mh3yf74uVdLxBy/6eOw7gHaREHf33Wn.usPvFiO	Lucía	Fernández	active	fe7b3ef4-6bfb-4e40-8c62-1ba7512936eb	2026-06-01 04:26:11.708366	2026-06-01 04:26:11.708366
3e89487d-5ac6-4918-a2f6-285158e42685	ana.quispe@est.univalle.edu	$2a$10$xQ5MdzaQ64FAz9Mh3yf74uVdLxBy/6eOw7gHaREHf33Wn.usPvFiO	Ana	Quispe	active	bf111da7-fca9-425c-94f7-a20d6b522872	2026-06-01 04:26:11.716051	2026-06-01 04:26:11.716051
3474ac2c-5bb1-4b32-811e-3b9be56f426a	luis.mamani@est.univalle.edu	$2a$10$xQ5MdzaQ64FAz9Mh3yf74uVdLxBy/6eOw7gHaREHf33Wn.usPvFiO	Luis	Mamani	active	bf111da7-fca9-425c-94f7-a20d6b522872	2026-06-01 04:26:11.744727	2026-06-01 04:26:11.744727
529eb732-ae96-4c20-b40c-9bea7241b280	daniela.rojas@est.univalle.edu	$2a$10$xQ5MdzaQ64FAz9Mh3yf74uVdLxBy/6eOw7gHaREHf33Wn.usPvFiO	Daniela	Rojas	active	bf111da7-fca9-425c-94f7-a20d6b522872	2026-06-01 04:26:11.767439	2026-06-01 04:26:11.767439
76846bf5-b493-4dcb-90db-e7979ae57232	pedro.choque@est.univalle.edu	$2a$10$xQ5MdzaQ64FAz9Mh3yf74uVdLxBy/6eOw7gHaREHf33Wn.usPvFiO	Pedro	Choque	active	bf111da7-fca9-425c-94f7-a20d6b522872	2026-06-01 04:26:11.788134	2026-06-01 04:26:11.788134
0e1d8f1d-7ab4-4c9a-ac0f-8243cda50648	camila.flores@est.univalle.edu	$2a$10$xQ5MdzaQ64FAz9Mh3yf74uVdLxBy/6eOw7gHaREHf33Wn.usPvFiO	Camila	Flores	active	bf111da7-fca9-425c-94f7-a20d6b522872	2026-06-01 04:26:11.806762	2026-06-01 04:26:11.806762
e3bc45fe-91ca-4568-921a-f0b1e23a0af0	diego.mendoza@est.univalle.edu	$2a$10$xQ5MdzaQ64FAz9Mh3yf74uVdLxBy/6eOw7gHaREHf33Wn.usPvFiO	Diego	Mendoza	active	bf111da7-fca9-425c-94f7-a20d6b522872	2026-06-01 04:26:11.829004	2026-06-01 04:26:11.829004
0c0b4baf-316a-42a7-be37-362d4cd83d7d	valeria.ticona@est.univalle.edu	$2a$10$xQ5MdzaQ64FAz9Mh3yf74uVdLxBy/6eOw7gHaREHf33Wn.usPvFiO	Valeria	Ticona	active	bf111da7-fca9-425c-94f7-a20d6b522872	2026-06-01 04:26:11.846181	2026-06-01 04:26:11.846181
b08b993e-34ed-45fa-bf0c-706672652755	sergio.apaza@est.univalle.edu	$2a$10$xQ5MdzaQ64FAz9Mh3yf74uVdLxBy/6eOw7gHaREHf33Wn.usPvFiO	Sergio	Apaza	active	bf111da7-fca9-425c-94f7-a20d6b522872	2026-06-01 04:26:11.864239	2026-06-01 04:26:11.864239
df18a8de-598a-48e0-a879-2497ff05fef9	gabriela.cruz@est.univalle.edu	$2a$10$xQ5MdzaQ64FAz9Mh3yf74uVdLxBy/6eOw7gHaREHf33Wn.usPvFiO	Gabriela	Cruz	active	bf111da7-fca9-425c-94f7-a20d6b522872	2026-06-01 04:26:11.881612	2026-06-01 04:26:11.881612
7416abd0-6bc6-464a-b75e-e07e3bab2a7d	andres.villca@est.univalle.edu	$2a$10$xQ5MdzaQ64FAz9Mh3yf74uVdLxBy/6eOw7gHaREHf33Wn.usPvFiO	Andrés	Villca	active	bf111da7-fca9-425c-94f7-a20d6b522872	2026-06-01 04:26:11.900588	2026-06-01 04:26:11.900588
dc37815d-f14f-42c3-bd2d-56fcc40fd921	paola.condori@est.univalle.edu	$2a$10$xQ5MdzaQ64FAz9Mh3yf74uVdLxBy/6eOw7gHaREHf33Wn.usPvFiO	Paola	Condori	active	bf111da7-fca9-425c-94f7-a20d6b522872	2026-06-01 04:26:11.918765	2026-06-01 04:26:11.918765
29dd6a8a-c818-40b7-a266-a8a6e4e252bf	marco.salazar@est.univalle.edu	$2a$10$xQ5MdzaQ64FAz9Mh3yf74uVdLxBy/6eOw7gHaREHf33Wn.usPvFiO	Marco	Salazar	active	bf111da7-fca9-425c-94f7-a20d6b522872	2026-06-01 04:26:11.935904	2026-06-01 04:26:11.935904
da993a24-7b36-4de0-9883-771bbb121c9d	fernanda.aramayo@est.univalle.edu	$2a$10$xQ5MdzaQ64FAz9Mh3yf74uVdLxBy/6eOw7gHaREHf33Wn.usPvFiO	Fernanda	Aramayo	active	bf111da7-fca9-425c-94f7-a20d6b522872	2026-06-01 04:26:11.953291	2026-06-01 04:26:11.953291
05c7f993-ca3e-4c4a-8b19-bbcf68f121f7	ivan.cabrera@est.univalle.edu	$2a$10$xQ5MdzaQ64FAz9Mh3yf74uVdLxBy/6eOw7gHaREHf33Wn.usPvFiO	Iván	Cabrera	active	bf111da7-fca9-425c-94f7-a20d6b522872	2026-06-01 04:26:11.969017	2026-06-01 04:26:11.969017
bff5a095-babd-4674-8bb6-2653221187dc	rosa.limachi@est.univalle.edu	$2a$10$xQ5MdzaQ64FAz9Mh3yf74uVdLxBy/6eOw7gHaREHf33Wn.usPvFiO	Rosa	Limachi	active	bf111da7-fca9-425c-94f7-a20d6b522872	2026-06-01 04:26:11.985923	2026-06-01 04:26:11.985923
d8e4922c-7e95-4e03-9dbc-08b0ff8815a9	tomas.suarez@est.univalle.edu	$2a$10$xQ5MdzaQ64FAz9Mh3yf74uVdLxBy/6eOw7gHaREHf33Wn.usPvFiO	Tomás	Suárez	active	bf111da7-fca9-425c-94f7-a20d6b522872	2026-06-01 04:26:12.003685	2026-06-01 04:26:12.003685
9a3be01f-61bc-4961-9590-6170b70bf02c	juanguille@univalle.edu	$2a$10$IlAh7Nx.1mWtIPlGezM9OevyLAYH7GNFcDc7CNZAq4vgqMISFBliC	Juan	Guillermo Perez	active	fddf887f-e7cd-4c60-ba1c-a59e0d257aaa	2026-06-01 12:37:42.334755	2026-06-01 12:37:42.334755
53830c43-6862-49a5-aec0-c121792a467e	rolanzambrana@univalle.edu	$2a$10$fMXevrxluCkqlOxUJwfZM.0aZ1I9secgpvLZebqIkpSoZGrUykpyS	Rolando	Zambrana Acha	inactive	fddf887f-e7cd-4c60-ba1c-a59e0d257aaa	2026-06-01 12:38:49.414967	2026-06-01 12:47:49.256906
036371dd-0abe-4a59-8c1a-5069fe5a43d3	carlos.perez@univalle.edu	$2a$10$xQ5MdzaQ64FAz9Mh3yf74uVdLxBy/6eOw7gHaREHf33Wn.usPvFiO	Carlos	Pérez	inactive	fddf887f-e7cd-4c60-ba1c-a59e0d257aaa	2026-06-01 04:26:11.683634	2026-06-01 12:48:02.218834
\.


--
-- Name: migrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: perfil_user
--

SELECT pg_catalog.setval('public.migrations_id_seq', 6, true);


--
-- Name: project_members PK_0b2f46f804be4aea9234c78bcc9; Type: CONSTRAINT; Schema: public; Owner: perfil_user
--

ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT "PK_0b2f46f804be4aea9234c78bcc9" PRIMARY KEY (id);


--
-- Name: skills PK_0d3212120f4ecedf90864d7e298; Type: CONSTRAINT; Schema: public; Owner: perfil_user
--

ALTER TABLE ONLY public.skills
    ADD CONSTRAINT "PK_0d3212120f4ecedf90864d7e298" PRIMARY KEY (id);


--
-- Name: student_profiles PK_5ed0a32eeaddfe812fb326177d0; Type: CONSTRAINT; Schema: public; Owner: perfil_user
--

ALTER TABLE ONLY public.student_profiles
    ADD CONSTRAINT "PK_5ed0a32eeaddfe812fb326177d0" PRIMARY KEY (id);


--
-- Name: projects PK_6271df0a7aed1d6c0691ce6ac50; Type: CONSTRAINT; Schema: public; Owner: perfil_user
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT "PK_6271df0a7aed1d6c0691ce6ac50" PRIMARY KEY (id);


--
-- Name: project_evidences PK_7bbf96b007655a6187bb121d49d; Type: CONSTRAINT; Schema: public; Owner: perfil_user
--

ALTER TABLE ONLY public.project_evidences
    ADD CONSTRAINT "PK_7bbf96b007655a6187bb121d49d" PRIMARY KEY (id);


--
-- Name: student_skills PK_7bf130eeaf4dcf90221ed38d1a6; Type: CONSTRAINT; Schema: public; Owner: perfil_user
--

ALTER TABLE ONLY public.student_skills
    ADD CONSTRAINT "PK_7bf130eeaf4dcf90221ed38d1a6" PRIMARY KEY (id);


--
-- Name: activities PK_7f4004429f731ffb9c88eb486a8; Type: CONSTRAINT; Schema: public; Owner: perfil_user
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT "PK_7f4004429f731ffb9c88eb486a8" PRIMARY KEY (id);


--
-- Name: migrations PK_8c82d7f526340ab734260ea46be; Type: CONSTRAINT; Schema: public; Owner: perfil_user
--

ALTER TABLE ONLY public.migrations
    ADD CONSTRAINT "PK_8c82d7f526340ab734260ea46be" PRIMARY KEY (id);


--
-- Name: student_interests PK_8e5757dc32afddbf8fc1f61d8bd; Type: CONSTRAINT; Schema: public; Owner: perfil_user
--

ALTER TABLE ONLY public.student_interests
    ADD CONSTRAINT "PK_8e5757dc32afddbf8fc1f61d8bd" PRIMARY KEY (id);


--
-- Name: academic_areas PK_9d9d2ebd23be1d08de6afb6ff7f; Type: CONSTRAINT; Schema: public; Owner: perfil_user
--

ALTER TABLE ONLY public.academic_areas
    ADD CONSTRAINT "PK_9d9d2ebd23be1d08de6afb6ff7f" PRIMARY KEY (id);


--
-- Name: users PK_a3ffb1c0c8416b9fc6f907b7433; Type: CONSTRAINT; Schema: public; Owner: perfil_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY (id);


--
-- Name: internal_constancies PK_ab252a5c2e5df06ad8fdfdff7e4; Type: CONSTRAINT; Schema: public; Owner: perfil_user
--

ALTER TABLE ONLY public.internal_constancies
    ADD CONSTRAINT "PK_ab252a5c2e5df06ad8fdfdff7e4" PRIMARY KEY (id);


--
-- Name: roles PK_c1433d71a4838793a49dcad46ab; Type: CONSTRAINT; Schema: public; Owner: perfil_user
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT "PK_c1433d71a4838793a49dcad46ab" PRIMARY KEY (id);


--
-- Name: external_certificates PK_d74a6831fb51ac4df715f74497d; Type: CONSTRAINT; Schema: public; Owner: perfil_user
--

ALTER TABLE ONLY public.external_certificates
    ADD CONSTRAINT "PK_d74a6831fb51ac4df715f74497d" PRIMARY KEY (id);


--
-- Name: affinity_results PK_e4e853da53e18de9acacf98497b; Type: CONSTRAINT; Schema: public; Owner: perfil_user
--

ALTER TABLE ONLY public.affinity_results
    ADD CONSTRAINT "PK_e4e853da53e18de9acacf98497b" PRIMARY KEY (id);


--
-- Name: activity_registrations PK_ed3d336c3b301af02e6f9ffcbd6; Type: CONSTRAINT; Schema: public; Owner: perfil_user
--

ALTER TABLE ONLY public.activity_registrations
    ADD CONSTRAINT "PK_ed3d336c3b301af02e6f9ffcbd6" PRIMARY KEY (id);


--
-- Name: student_profiles REL_cef016a0d95e26ae7c0f167ec2; Type: CONSTRAINT; Schema: public; Owner: perfil_user
--

ALTER TABLE ONLY public.student_profiles
    ADD CONSTRAINT "REL_cef016a0d95e26ae7c0f167ec2" UNIQUE (user_id);


--
-- Name: activity_registrations uq_activity_registration; Type: CONSTRAINT; Schema: public; Owner: perfil_user
--

ALTER TABLE ONLY public.activity_registrations
    ADD CONSTRAINT uq_activity_registration UNIQUE (activity_id, student_profile_id);


--
-- Name: affinity_results uq_affinity_result; Type: CONSTRAINT; Schema: public; Owner: perfil_user
--

ALTER TABLE ONLY public.affinity_results
    ADD CONSTRAINT uq_affinity_result UNIQUE (student_profile_id, academic_area_id);


--
-- Name: project_members uq_project_member; Type: CONSTRAINT; Schema: public; Owner: perfil_user
--

ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT uq_project_member UNIQUE (project_id, user_id);


--
-- Name: student_interests uq_student_interest; Type: CONSTRAINT; Schema: public; Owner: perfil_user
--

ALTER TABLE ONLY public.student_interests
    ADD CONSTRAINT uq_student_interest UNIQUE (student_profile_id, academic_area_id);


--
-- Name: student_skills uq_student_skill; Type: CONSTRAINT; Schema: public; Owner: perfil_user
--

ALTER TABLE ONLY public.student_skills
    ADD CONSTRAINT uq_student_skill UNIQUE (student_profile_id, skill_id);


--
-- Name: IDX_094f87ce814bd60bae98a47345; Type: INDEX; Schema: public; Owner: perfil_user
--

CREATE INDEX "IDX_094f87ce814bd60bae98a47345" ON public.projects USING btree (created_by_profile_id);


--
-- Name: IDX_11457b0f8b1621d944a6aaedec; Type: INDEX; Schema: public; Owner: perfil_user
--

CREATE INDEX "IDX_11457b0f8b1621d944a6aaedec" ON public.activities USING btree (category);


--
-- Name: IDX_146a66975e0a017af25c63c665; Type: INDEX; Schema: public; Owner: perfil_user
--

CREATE INDEX "IDX_146a66975e0a017af25c63c665" ON public.activities USING btree (status);


--
-- Name: IDX_14cec42ca75fec1519492a4929; Type: INDEX; Schema: public; Owner: perfil_user
--

CREATE INDEX "IDX_14cec42ca75fec1519492a4929" ON public.internal_constancies USING btree (student_profile_id);


--
-- Name: IDX_22df62931512c384a1ea7c3bad; Type: INDEX; Schema: public; Owner: perfil_user
--

CREATE INDEX "IDX_22df62931512c384a1ea7c3bad" ON public.student_skills USING btree (student_profile_id);


--
-- Name: IDX_343302c16aba87992e012f6944; Type: INDEX; Schema: public; Owner: perfil_user
--

CREATE INDEX "IDX_343302c16aba87992e012f6944" ON public.project_evidences USING btree (project_id);


--
-- Name: IDX_379f5842981fcdc1dc3c886b86; Type: INDEX; Schema: public; Owner: perfil_user
--

CREATE INDEX "IDX_379f5842981fcdc1dc3c886b86" ON public.student_skills USING btree (skill_id);


--
-- Name: IDX_386ae46353ccef9141daac674d; Type: INDEX; Schema: public; Owner: perfil_user
--

CREATE INDEX "IDX_386ae46353ccef9141daac674d" ON public.student_interests USING btree (academic_area_id);


--
-- Name: IDX_4101a088bf42022b4c68f5f920; Type: INDEX; Schema: public; Owner: perfil_user
--

CREATE INDEX "IDX_4101a088bf42022b4c68f5f920" ON public.student_interests USING btree (student_profile_id);


--
-- Name: IDX_5fe0af9cc3f00241eb7d01d1a6; Type: INDEX; Schema: public; Owner: perfil_user
--

CREATE INDEX "IDX_5fe0af9cc3f00241eb7d01d1a6" ON public.external_certificates USING btree (student_profile_id);


--
-- Name: IDX_60e5eab8ffc315375bc48a973c; Type: INDEX; Schema: public; Owner: perfil_user
--

CREATE INDEX "IDX_60e5eab8ffc315375bc48a973c" ON public.skills USING btree (academic_area_id);


--
-- Name: IDX_648e3f5447f725579d7d4ffdfb; Type: INDEX; Schema: public; Owner: perfil_user
--

CREATE UNIQUE INDEX "IDX_648e3f5447f725579d7d4ffdfb" ON public.roles USING btree (name);


--
-- Name: IDX_704a5fe2080d400189b76938cd; Type: INDEX; Schema: public; Owner: perfil_user
--

CREATE INDEX "IDX_704a5fe2080d400189b76938cd" ON public.activities USING btree (type);


--
-- Name: IDX_7a66baf31b37f3b9301a0e621d; Type: INDEX; Schema: public; Owner: perfil_user
--

CREATE UNIQUE INDEX "IDX_7a66baf31b37f3b9301a0e621d" ON public.student_profiles USING btree (university_code);


--
-- Name: IDX_81f05095507fd84aa2769b4a52; Type: INDEX; Schema: public; Owner: perfil_user
--

CREATE UNIQUE INDEX "IDX_81f05095507fd84aa2769b4a52" ON public.skills USING btree (name);


--
-- Name: IDX_97672ac88f789774dd47f7c8be; Type: INDEX; Schema: public; Owner: perfil_user
--

CREATE UNIQUE INDEX "IDX_97672ac88f789774dd47f7c8be" ON public.users USING btree (email);


--
-- Name: IDX_9d0079daebb6fa81c5d40faa84; Type: INDEX; Schema: public; Owner: perfil_user
--

CREATE INDEX "IDX_9d0079daebb6fa81c5d40faa84" ON public.affinity_results USING btree (academic_area_id);


--
-- Name: IDX_a2cecd1a3531c0b041e29ba46e; Type: INDEX; Schema: public; Owner: perfil_user
--

CREATE INDEX "IDX_a2cecd1a3531c0b041e29ba46e" ON public.users USING btree (role_id);


--
-- Name: IDX_b21638a8c330ae083afbfb4a40; Type: INDEX; Schema: public; Owner: perfil_user
--

CREATE INDEX "IDX_b21638a8c330ae083afbfb4a40" ON public.activity_registrations USING btree (student_profile_id);


--
-- Name: IDX_b4a09769351466c6567161cf1e; Type: INDEX; Schema: public; Owner: perfil_user
--

CREATE INDEX "IDX_b4a09769351466c6567161cf1e" ON public.activities USING btree (academic_area_id);


--
-- Name: IDX_b5729113570c20c7e214cf3f58; Type: INDEX; Schema: public; Owner: perfil_user
--

CREATE INDEX "IDX_b5729113570c20c7e214cf3f58" ON public.project_members USING btree (project_id);


--
-- Name: IDX_bcc386851d4476e5fab2a683c3; Type: INDEX; Schema: public; Owner: perfil_user
--

CREATE INDEX "IDX_bcc386851d4476e5fab2a683c3" ON public.activity_registrations USING btree (activity_id);


--
-- Name: IDX_c168bdb675b12baab72abe2c1e; Type: INDEX; Schema: public; Owner: perfil_user
--

CREATE UNIQUE INDEX "IDX_c168bdb675b12baab72abe2c1e" ON public.academic_areas USING btree (name);


--
-- Name: IDX_cef016a0d95e26ae7c0f167ec2; Type: INDEX; Schema: public; Owner: perfil_user
--

CREATE UNIQUE INDEX "IDX_cef016a0d95e26ae7c0f167ec2" ON public.student_profiles USING btree (user_id);


--
-- Name: IDX_e89aae80e010c2faa72e6a49ce; Type: INDEX; Schema: public; Owner: perfil_user
--

CREATE INDEX "IDX_e89aae80e010c2faa72e6a49ce" ON public.project_members USING btree (user_id);


--
-- Name: IDX_ec6de185916136cb2fbddd32ff; Type: INDEX; Schema: public; Owner: perfil_user
--

CREATE INDEX "IDX_ec6de185916136cb2fbddd32ff" ON public.projects USING btree (academic_area_id);


--
-- Name: IDX_ee5099d75a475f8543d635f7df; Type: INDEX; Schema: public; Owner: perfil_user
--

CREATE INDEX "IDX_ee5099d75a475f8543d635f7df" ON public.affinity_results USING btree (student_profile_id);


--
-- Name: IDX_f62723d88ccd72e9192bca6292; Type: INDEX; Schema: public; Owner: perfil_user
--

CREATE INDEX "IDX_f62723d88ccd72e9192bca6292" ON public.activities USING btree (creator_id);


--
-- Name: projects FK_094f87ce814bd60bae98a47345a; Type: FK CONSTRAINT; Schema: public; Owner: perfil_user
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT "FK_094f87ce814bd60bae98a47345a" FOREIGN KEY (created_by_profile_id) REFERENCES public.student_profiles(id) ON DELETE CASCADE;


--
-- Name: activity_registrations FK_10fe7a1497ad9c4bccd15b4366a; Type: FK CONSTRAINT; Schema: public; Owner: perfil_user
--

ALTER TABLE ONLY public.activity_registrations
    ADD CONSTRAINT "FK_10fe7a1497ad9c4bccd15b4366a" FOREIGN KEY (confirmed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: internal_constancies FK_14cec42ca75fec1519492a49291; Type: FK CONSTRAINT; Schema: public; Owner: perfil_user
--

ALTER TABLE ONLY public.internal_constancies
    ADD CONSTRAINT "FK_14cec42ca75fec1519492a49291" FOREIGN KEY (student_profile_id) REFERENCES public.student_profiles(id) ON DELETE CASCADE;


--
-- Name: student_skills FK_22df62931512c384a1ea7c3bad4; Type: FK CONSTRAINT; Schema: public; Owner: perfil_user
--

ALTER TABLE ONLY public.student_skills
    ADD CONSTRAINT "FK_22df62931512c384a1ea7c3bad4" FOREIGN KEY (student_profile_id) REFERENCES public.student_profiles(id) ON DELETE CASCADE;


--
-- Name: project_evidences FK_343302c16aba87992e012f69445; Type: FK CONSTRAINT; Schema: public; Owner: perfil_user
--

ALTER TABLE ONLY public.project_evidences
    ADD CONSTRAINT "FK_343302c16aba87992e012f69445" FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: student_skills FK_379f5842981fcdc1dc3c886b86d; Type: FK CONSTRAINT; Schema: public; Owner: perfil_user
--

ALTER TABLE ONLY public.student_skills
    ADD CONSTRAINT "FK_379f5842981fcdc1dc3c886b86d" FOREIGN KEY (skill_id) REFERENCES public.skills(id) ON DELETE CASCADE;


--
-- Name: student_interests FK_386ae46353ccef9141daac674d0; Type: FK CONSTRAINT; Schema: public; Owner: perfil_user
--

ALTER TABLE ONLY public.student_interests
    ADD CONSTRAINT "FK_386ae46353ccef9141daac674d0" FOREIGN KEY (academic_area_id) REFERENCES public.academic_areas(id) ON DELETE CASCADE;


--
-- Name: student_interests FK_4101a088bf42022b4c68f5f9207; Type: FK CONSTRAINT; Schema: public; Owner: perfil_user
--

ALTER TABLE ONLY public.student_interests
    ADD CONSTRAINT "FK_4101a088bf42022b4c68f5f9207" FOREIGN KEY (student_profile_id) REFERENCES public.student_profiles(id) ON DELETE CASCADE;


--
-- Name: internal_constancies FK_4414a97da3a6af1fabbb1411fd8; Type: FK CONSTRAINT; Schema: public; Owner: perfil_user
--

ALTER TABLE ONLY public.internal_constancies
    ADD CONSTRAINT "FK_4414a97da3a6af1fabbb1411fd8" FOREIGN KEY (authorized_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: internal_constancies FK_58ccdc4c1533fbf65335a76a65b; Type: FK CONSTRAINT; Schema: public; Owner: perfil_user
--

ALTER TABLE ONLY public.internal_constancies
    ADD CONSTRAINT "FK_58ccdc4c1533fbf65335a76a65b" FOREIGN KEY (activity_registration_id) REFERENCES public.activity_registrations(id) ON DELETE SET NULL;


--
-- Name: external_certificates FK_5fe0af9cc3f00241eb7d01d1a6b; Type: FK CONSTRAINT; Schema: public; Owner: perfil_user
--

ALTER TABLE ONLY public.external_certificates
    ADD CONSTRAINT "FK_5fe0af9cc3f00241eb7d01d1a6b" FOREIGN KEY (student_profile_id) REFERENCES public.student_profiles(id) ON DELETE CASCADE;


--
-- Name: skills FK_60e5eab8ffc315375bc48a973c1; Type: FK CONSTRAINT; Schema: public; Owner: perfil_user
--

ALTER TABLE ONLY public.skills
    ADD CONSTRAINT "FK_60e5eab8ffc315375bc48a973c1" FOREIGN KEY (academic_area_id) REFERENCES public.academic_areas(id) ON DELETE SET NULL;


--
-- Name: affinity_results FK_9d0079daebb6fa81c5d40faa84b; Type: FK CONSTRAINT; Schema: public; Owner: perfil_user
--

ALTER TABLE ONLY public.affinity_results
    ADD CONSTRAINT "FK_9d0079daebb6fa81c5d40faa84b" FOREIGN KEY (academic_area_id) REFERENCES public.academic_areas(id) ON DELETE CASCADE;


--
-- Name: users FK_a2cecd1a3531c0b041e29ba46e1; Type: FK CONSTRAINT; Schema: public; Owner: perfil_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "FK_a2cecd1a3531c0b041e29ba46e1" FOREIGN KEY (role_id) REFERENCES public.roles(id);


--
-- Name: activity_registrations FK_b21638a8c330ae083afbfb4a40b; Type: FK CONSTRAINT; Schema: public; Owner: perfil_user
--

ALTER TABLE ONLY public.activity_registrations
    ADD CONSTRAINT "FK_b21638a8c330ae083afbfb4a40b" FOREIGN KEY (student_profile_id) REFERENCES public.student_profiles(id) ON DELETE CASCADE;


--
-- Name: activities FK_b4a09769351466c6567161cf1e6; Type: FK CONSTRAINT; Schema: public; Owner: perfil_user
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT "FK_b4a09769351466c6567161cf1e6" FOREIGN KEY (academic_area_id) REFERENCES public.academic_areas(id) ON DELETE SET NULL;


--
-- Name: project_members FK_b5729113570c20c7e214cf3f58d; Type: FK CONSTRAINT; Schema: public; Owner: perfil_user
--

ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT "FK_b5729113570c20c7e214cf3f58d" FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: activity_registrations FK_bcc386851d4476e5fab2a683c39; Type: FK CONSTRAINT; Schema: public; Owner: perfil_user
--

ALTER TABLE ONLY public.activity_registrations
    ADD CONSTRAINT "FK_bcc386851d4476e5fab2a683c39" FOREIGN KEY (activity_id) REFERENCES public.activities(id) ON DELETE CASCADE;


--
-- Name: internal_constancies FK_ca23e550eaf912f87d53d2134e3; Type: FK CONSTRAINT; Schema: public; Owner: perfil_user
--

ALTER TABLE ONLY public.internal_constancies
    ADD CONSTRAINT "FK_ca23e550eaf912f87d53d2134e3" FOREIGN KEY (activity_id) REFERENCES public.activities(id) ON DELETE SET NULL;


--
-- Name: student_profiles FK_cef016a0d95e26ae7c0f167ec28; Type: FK CONSTRAINT; Schema: public; Owner: perfil_user
--

ALTER TABLE ONLY public.student_profiles
    ADD CONSTRAINT "FK_cef016a0d95e26ae7c0f167ec28" FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: project_members FK_e89aae80e010c2faa72e6a49ce8; Type: FK CONSTRAINT; Schema: public; Owner: perfil_user
--

ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT "FK_e89aae80e010c2faa72e6a49ce8" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: projects FK_ec6de185916136cb2fbddd32ff6; Type: FK CONSTRAINT; Schema: public; Owner: perfil_user
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT "FK_ec6de185916136cb2fbddd32ff6" FOREIGN KEY (academic_area_id) REFERENCES public.academic_areas(id) ON DELETE SET NULL;


--
-- Name: affinity_results FK_ee5099d75a475f8543d635f7dfd; Type: FK CONSTRAINT; Schema: public; Owner: perfil_user
--

ALTER TABLE ONLY public.affinity_results
    ADD CONSTRAINT "FK_ee5099d75a475f8543d635f7dfd" FOREIGN KEY (student_profile_id) REFERENCES public.student_profiles(id) ON DELETE CASCADE;


--
-- Name: activities FK_f62723d88ccd72e9192bca62923; Type: FK CONSTRAINT; Schema: public; Owner: perfil_user
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT "FK_f62723d88ccd72e9192bca62923" FOREIGN KEY (creator_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

\unrestrict JBmDbjnO4fk0Zzm8C6cGFXUBgmmwKobHYshnjqz3V3ikR8UpXuUVazfsC2biGu2

