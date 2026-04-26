# Backend — Spring Boot, hexagonal + DDD

Spec et plan d'implémentation du backend qui expose l'API décrite dans [`openapi.yaml`](./openapi.yaml) et se déploie comme service `backend` de [`docker-compose.yml`](./docker-compose.yml).

Contrat imposé par le reste du système :
- Port d'écoute **3000** (`nginx.conf` reverse-proxy `/api/*` → `http://backend:3000`)
- Toutes les routes préfixées par `/api`
- JWT bearer pour l'authentification
- Même shape de modèles que dans `openapi.yaml` / `src/types.ts` (discriminateur `type` pour les questions, tableau 2D `questions[cat][tier]`, etc.)

---

## 1. Stack technique

| Brique | Choix | Raison |
| --- | --- | --- |
| Langage | **Java 21** | `record`, `sealed` types, pattern matching — s'alignent bien avec DDD |
| Framework | **Spring Boot 3.3+** | Stack demandée |
| API HTTP | **Spring Web** (MVC) | Stack demandée |
| Sécurité | **Spring Security 6** | Stack demandée |
| Persistance | **Spring Data JPA + Hibernate 6** | Stack demandée |
| SGBD | **PostgreSQL 17** | Service `db` du compose |
| JWT | **jjwt** (`io.jsonwebtoken`) | Standard, bien maintenu |
| Hash mot de passe | **BCrypt** (via `BCryptPasswordEncoder`) | Natif Spring Security |
| Migrations | **Flyway** | Simple, versionné |
| Validation | **Bean Validation** (`jakarta.validation`) | Standard |
| Tests | **JUnit 5, AssertJ, Mockito, Testcontainers** | Standard |
| Build | **Maven** ou **Gradle** | Au choix |

---

## 2. Architecture hexagonale + DDD

### Règles de dépendance (strictes)

```
       driving (inbound)                         driven (outbound)
  ┌─────────────────────────┐                ┌───────────────────────────┐
  │ infrastructure.web      │                │ infrastructure.persistence │
  │  - @RestController      │                │  - @Entity                 │
  │  - DTOs, mappers        │                │  - Spring Data repos       │
  └──────────┬──────────────┘                └────────────▲───────────────┘
             │                                            │
             │            ┌──────────────────┐            │
             ▼            │ application      │            │
  ┌─────────────────┐     │  - services      │     ┌──────┴──────────┐
  │ domain.port.in  │◀────┤  (implémentent   ├────▶│ domain.port.out │
  │ (use cases)     │     │   les use cases) │     │ (repositories,  │
  │                 │     │                  │     │  services tech) │
  └─────────────────┘     └────────┬─────────┘     └─────────────────┘
                                   │
                                   ▼
                          ┌─────────────────┐
                          │ domain.model    │
                          │ - agrégats      │
                          │ - VO            │
                          │ - invariants    │
                          └─────────────────┘

           infrastructure ─▶ application ─▶ domain
                           (jamais l'inverse)
```

- Le package `domain` ne dépend **de rien** (ni Spring, ni JPA, ni Jackson).
- `application` ne dépend que de `domain`.
- `infrastructure` dépend de `domain` et `application` (c'est la seule couche autorisée à connaître Spring / Hibernate).
- Les `@Entity` JPA vivent dans `infrastructure.persistence.entity` et sont **distinctes** des agrégats du domaine. Mapping explicite via un `*PersistenceMapper`.

### Structure des packages

```
com.genialquizz
├── domain
│   ├── model
│   │   ├── user
│   │   │   ├── User.java                  # agrégat racine
│   │   │   ├── UserId.java                # VO
│   │   │   ├── Username.java              # VO (validation)
│   │   │   └── HashedPassword.java        # VO
│   │   └── quiz
│   │       ├── Quiz.java                  # agrégat racine
│   │       ├── QuizId.java
│   │       ├── Category.java
│   │       ├── Question.java              # sealed interface
│   │       ├── DirectQuestion.java        # record implements Question
│   │       ├── GuessTheMostQuestion.java  # record implements Question
│   │       ├── GuessWord.java             # record
│   │       └── PointTier.java             # VO
│   ├── exception
│   │   ├── DomainException.java
│   │   ├── UsernameAlreadyTakenException.java
│   │   ├── InvalidCredentialsException.java
│   │   ├── QuizNotFoundException.java
│   │   └── QuizAccessDeniedException.java
│   └── port
│       ├── in                                  # use cases (driving)
│       │   ├── RegisterUserUseCase.java
│       │   ├── LoginUseCase.java
│       │   ├── GetCurrentUserUseCase.java
│       │   ├── ListMyQuizzesUseCase.java
│       │   ├── ListPublicQuizzesUseCase.java
│       │   ├── GetQuizUseCase.java
│       │   ├── CreateQuizUseCase.java
│       │   ├── UpdateQuizUseCase.java
│       │   └── DeleteQuizUseCase.java
│       └── out                                 # ports sortants (driven)
│           ├── UserRepository.java
│           ├── QuizRepository.java
│           ├── PasswordHasher.java
│           ├── TokenIssuer.java
│           └── Clock.java                      # time port (testabilité)
├── application
│   └── service
│       ├── AuthService.java                    # @Service, implémente use cases auth
│       └── QuizService.java                    # @Service, implémente use cases quiz
└── infrastructure
    ├── web
    │   ├── AuthController.java
    │   ├── QuizController.java
    │   ├── dto
    │   │   ├── AuthCredentialsDto.java
    │   │   ├── AuthResponseDto.java
    │   │   ├── UserDto.java
    │   │   ├── QuizSummaryDto.java
    │   │   ├── QuizDetailDto.java
    │   │   ├── QuizInputDto.java
    │   │   ├── QuestionDto.java               # avec @JsonTypeInfo discriminateur
    │   │   ├── DirectQuestionDto.java
    │   │   ├── GuessTheMostQuestionDto.java
    │   │   ├── GuessWordDto.java
    │   │   └── ErrorDto.java
    │   ├── mapper
    │   │   ├── UserWebMapper.java
    │   │   └── QuizWebMapper.java
    │   └── error
    │       └── GlobalExceptionHandler.java    # @RestControllerAdvice
    ├── persistence
    │   ├── entity
    │   │   ├── UserJpaEntity.java
    │   │   └── QuizJpaEntity.java             # contenu quiz en JSONB
    │   ├── repository
    │   │   ├── UserJpaRepository.java         # Spring Data
    │   │   └── QuizJpaRepository.java
    │   ├── adapter
    │   │   ├── UserRepositoryAdapter.java     # implémente domain.port.out.UserRepository
    │   │   └── QuizRepositoryAdapter.java
    │   └── mapper
    │       ├── UserPersistenceMapper.java
    │       └── QuizPersistenceMapper.java
    ├── security
    │   ├── SecurityConfig.java                # @EnableWebSecurity
    │   ├── JwtAuthenticationFilter.java
    │   ├── JwtTokenIssuerAdapter.java         # implémente TokenIssuer
    │   ├── BcryptPasswordHasherAdapter.java   # implémente PasswordHasher
    │   ├── AuthenticatedUserProvider.java     # lit SecurityContext → UserId
    │   └── AuthProperties.java                # @ConfigurationProperties
    └── config
        ├── SystemClockAdapter.java            # implémente Clock
        └── JacksonConfig.java                 # discriminateur Question
```

---

## 3. Modèle de domaine

### Agrégat `User`

```java
public final class User {
    private final UserId id;
    private final Username username;
    private final HashedPassword password;
    private final Instant createdAt;

    public static User register(Username username, HashedPassword password, Clock clock) {
        return new User(UserId.newId(), username, password, clock.now());
    }

    public boolean matches(String rawPassword, PasswordHasher hasher) {
        return hasher.matches(rawPassword, this.password);
    }
    // getters — pas de setters, immuable
}
```

Value objects (tous immuables) :
- `UserId` : wrap `UUID`, factory `newId()`, `of(String)`.
- `Username` : valide `3 ≤ len ≤ 50`, pattern `^[a-zA-Z0-9_-]+$` (à l'instanciation, pas en annotation).
- `HashedPassword` : simple wrap `String`, jamais loggé (override `toString()`), ne contient **jamais** le mot de passe en clair.

### Agrégat `Quiz`

```java
public final class Quiz {
    private final QuizId id;
    private final UserId ownerId;
    private String name;
    private boolean publicVisibility;
    private final List<Category> categories;
    private final List<Integer> pointTiers;
    private final Instant createdAt;
    private Instant updatedAt;

    public static Quiz create(UserId owner, QuizDraft draft, Clock clock) { ... }

    public void update(QuizDraft draft, UserId requester, Clock clock) {
        requireOwner(requester);
        // applique les changements, invariants, updatedAt = now
    }

    public boolean isVisibleTo(UserId requester) {
        return publicVisibility || id.equals(requester);  // cf. règle métier
    }

    private void requireOwner(UserId requester) {
        if (!ownerId.equals(requester)) throw new QuizAccessDeniedException();
    }
}
```

- `QuizDraft` : record regroupant les champs modifiables (name, isPublic, categories, pointTiers, questions) — structure plate passée par les use cases.
- `Category` : record `(String name, List<Question> questions)`.
- `Question` : `sealed interface` permettant `DirectQuestion` et `GuessTheMostQuestion`.
- `DirectQuestion` : record `(String text, String answer, Optional<String> imageUrl)`.
- `GuessTheMostQuestion` : record `(String text, List<GuessWord> words, Optional<String> imageUrl)`.
- `GuessWord` : record `(String word)` — `foundBy` du front est exclusivement runtime et **n'est pas persisté**.

Invariants à vérifier à la création / mise à jour :
- `name` non vide, ≤ 120 chars
- `categories` non vide
- `pointTiers` non vide, entiers ≥ 0
- `questions.size() == categories.size()`
- `questions[i].size() == pointTiers.size()` pour chaque `i`
- Pour `GuessTheMostQuestion` : `words` non vide

Un invariant violé doit lever une `DomainException` (sous-classée en `InvalidQuizException`).

---

## 4. Ports

### Inbound (`domain.port.in`)

Un use case = une interface à une seule méthode publique (SRP), implémentée par un `@Service`. Commandes = `record`.

```java
public interface RegisterUserUseCase {
    AuthResult handle(RegisterCommand cmd);
    record RegisterCommand(String username, String password) {}
    record AuthResult(User user, String token) {}
}

public interface LoginUseCase {
    AuthResult handle(LoginCommand cmd);
    record LoginCommand(String username, String password) {}
}

public interface CreateQuizUseCase {
    Quiz handle(CreateQuizCommand cmd);
    record CreateQuizCommand(UserId owner, QuizDraft draft) {}
}

public interface UpdateQuizUseCase {
    Quiz handle(UpdateQuizCommand cmd);
    record UpdateQuizCommand(QuizId id, UserId requester, QuizDraft draft) {}
}

public interface DeleteQuizUseCase {
    void handle(QuizId id, UserId requester);
}

public interface GetQuizUseCase {
    /** requester peut être null (appel anonyme). Le use case applique la règle de visibilité. */
    Quiz handle(QuizId id, UserId requester);
}

public interface ListMyQuizzesUseCase   { List<QuizSummary> handle(UserId owner); }
public interface ListPublicQuizzesUseCase { List<QuizSummary> handle(); }
public interface GetCurrentUserUseCase   { User handle(UserId id); }
```

`QuizSummary` est un record domaine dérivé (id, name, ownerId, ownerUsername, isPublic, categoryCount, questionCount, timestamps). Peut vivre dans `domain.model.quiz`.

### Outbound (`domain.port.out`)

```java
public interface UserRepository {
    Optional<User> findById(UserId id);
    Optional<User> findByUsername(Username username);
    boolean existsByUsername(Username username);
    User save(User user);
}

public interface QuizRepository {
    Optional<Quiz> findById(QuizId id);
    List<QuizSummary> findAllSummariesByOwner(UserId owner);
    List<QuizSummary> findAllPublicSummaries();
    Quiz save(Quiz quiz);
    void deleteById(QuizId id);
}

public interface PasswordHasher {
    HashedPassword hash(String raw);
    boolean matches(String raw, HashedPassword hashed);
}

public interface TokenIssuer {
    String issue(User user);
    /** Lance InvalidTokenException si invalide. */
    UserId verify(String token);
}

public interface Clock { Instant now(); }
```

Aucune de ces interfaces ne parle de Spring ou JPA.

---

## 5. Adaptateurs

### Web (inbound)

`AuthController` — expose `/api/auth/*` :

| Route | Use case |
| --- | --- |
| `POST /api/auth/register` | `RegisterUserUseCase` |
| `POST /api/auth/login` | `LoginUseCase` |
| `GET  /api/auth/me` | `GetCurrentUserUseCase` |

`QuizController` — expose `/api/quizzes*` :

| Route | Use case | Auth |
| --- | --- | --- |
| `GET    /api/quizzes` | `ListMyQuizzesUseCase` | requise |
| `GET    /api/quizzes/public` | `ListPublicQuizzesUseCase` | anonyme OK |
| `POST   /api/quizzes` | `CreateQuizUseCase` | requise |
| `GET    /api/quizzes/{id}` | `GetQuizUseCase` | optionnelle (public OK) |
| `PUT    /api/quizzes/{id}` | `UpdateQuizUseCase` | propriétaire |
| `DELETE /api/quizzes/{id}` | `DeleteQuizUseCase` | propriétaire |

Les contrôleurs :
1. Reçoivent un DTO (`@Valid`).
2. Le convertissent en `Command` ou `QuizDraft` via un mapper.
3. Appellent le use case.
4. Mappent le résultat (agrégat) vers un `*Dto` de sortie.
5. **Jamais** d'annotation JPA ou de logique métier dans cette couche.

DTOs — le discriminateur `type` sur `Question` :

```java
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = "type", include = As.EXISTING_PROPERTY)
@JsonSubTypes({
    @JsonSubTypes.Type(value = DirectQuestionDto.class,       name = "direct"),
    @JsonSubTypes.Type(value = GuessTheMostQuestionDto.class, name = "guess_the_most"),
})
public sealed interface QuestionDto permits DirectQuestionDto, GuessTheMostQuestionDto { ... }
```

### Persistance (outbound)

Deux tables seulement (le quiz est stocké en JSONB — c'est un agrégat dense, jamais requêté champ par champ) :

```sql
-- V1__init.sql
create table users (
    id              uuid        primary key,
    username        varchar(50) not null unique,
    password_hash   varchar(100) not null,
    created_at      timestamptz not null default now()
);

create table quizzes (
    id              uuid        primary key,
    owner_id        uuid        not null references users(id) on delete cascade,
    name            varchar(120) not null,
    is_public       boolean     not null default false,
    point_tiers     integer[]   not null,
    content         jsonb       not null,      -- categories + questions 2D
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

create index idx_quizzes_owner   on quizzes (owner_id);
create index idx_quizzes_public  on quizzes (is_public) where is_public;
```

Entités JPA :

```java
@Entity
@Table(name = "users")
public class UserJpaEntity {
    @Id private UUID id;
    @Column(nullable = false, unique = true) private String username;
    @Column(name = "password_hash", nullable = false) private String passwordHash;
    @Column(name = "created_at", nullable = false) private Instant createdAt;
    // getters/setters/protected constructor
}

@Entity
@Table(name = "quizzes")
public class QuizJpaEntity {
    @Id private UUID id;
    @Column(name = "owner_id", nullable = false) private UUID ownerId;
    @Column(nullable = false) private String name;
    @Column(name = "is_public", nullable = false) private boolean publicVisibility;

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "point_tiers", nullable = false, columnDefinition = "integer[]")
    private Integer[] pointTiers;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private QuizContentJson content;   // POJO sérialisé par Jackson (Hibernate 6 natif)

    @Column(name = "created_at") private Instant createdAt;
    @Column(name = "updated_at") private Instant updatedAt;
}
```

`QuizContentJson` est un POJO de sérialisation local à la couche persistance (liste de catégories avec questions polymorphes). Le `QuizPersistenceMapper` le convertit en `List<Category>` du domaine.

Les adapters implémentent les ports sortants :

```java
@Component
class UserRepositoryAdapter implements UserRepository {
    private final UserJpaRepository jpa;
    private final UserPersistenceMapper mapper;

    public Optional<User> findByUsername(Username u) {
        return jpa.findByUsername(u.value()).map(mapper::toDomain);
    }
    // ...
}
```

### Sécurité (JWT)

`JwtTokenIssuerAdapter` (implémente `TokenIssuer`) :
- Signe avec HS256 + `AuthProperties.secret` (env `JWT_SECRET`, ≥ 32 bytes).
- Claims : `sub = userId`, `username`, `iat`, `exp` (par défaut `JWT_EXPIRES_IN` = `7d`).
- `verify` parse, vérifie la signature + l'expiration, retourne `UserId`.

`BcryptPasswordHasherAdapter` (implémente `PasswordHasher`) : wrappe `BCryptPasswordEncoder` (strength 12).

`JwtAuthenticationFilter` :
- Extends `OncePerRequestFilter`.
- Lit header `Authorization: Bearer <token>`.
- Si présent et valide : crée une `UsernamePasswordAuthenticationToken` avec `principal = UserId`, et `authorities = [ROLE_USER]`.
- Si absent ou invalide : laisse passer **sans** poser d'auth (l'endpoint décidera si l'anonymat est accepté).

`SecurityConfig` (esquisse) :

```java
@Configuration @EnableWebSecurity
class SecurityConfig {
    @Bean
    SecurityFilterChain chain(HttpSecurity http, JwtAuthenticationFilter jwt) throws Exception {
        return http
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(a -> a
                .requestMatchers(HttpMethod.POST, "/api/auth/register", "/api/auth/login").permitAll()
                .requestMatchers(HttpMethod.GET,  "/api/quizzes/public").permitAll()
                .requestMatchers(HttpMethod.GET,  "/api/quizzes/*").permitAll()  // visibilité appliquée dans le use case
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwt, UsernamePasswordAuthenticationFilter.class)
            .exceptionHandling(e -> e
                .authenticationEntryPoint((req, res, ex) -> res.sendError(401))
                .accessDeniedHandler((req, res, ex) -> res.sendError(403))
            )
            .build();
    }

    @Bean
    PasswordEncoder passwordEncoder() { return new BCryptPasswordEncoder(12); }
}
```

`AuthenticatedUserProvider` : utilitaire injecté dans `QuizController` pour récupérer l'`UserId` courant depuis `SecurityContextHolder` (ou `null` pour les appels anonymes autorisés sur `GET /api/quizzes/{id}`).

CORS : **non requis** en production (même origine, nginx reverse-proxy). Garder désactivé par défaut pour réduire la surface.

---

## 6. Gestion d'erreurs

`GlobalExceptionHandler` (`@RestControllerAdvice`) map les exceptions du domaine sur les statuts HTTP :

| Exception | Statut | `code` |
| --- | --- | --- |
| `UsernameAlreadyTakenException` | 409 | `USERNAME_TAKEN` |
| `InvalidCredentialsException` | 401 | `INVALID_CREDENTIALS` |
| `InvalidTokenException` | 401 | `INVALID_TOKEN` |
| `QuizNotFoundException` | 404 | `QUIZ_NOT_FOUND` |
| `QuizAccessDeniedException` | 403 | `QUIZ_FORBIDDEN` |
| `InvalidQuizException` | 400 | `INVALID_QUIZ` |
| `MethodArgumentNotValidException` | 400 | `VALIDATION_ERROR` (+ `details`) |
| Autre | 500 | `INTERNAL_ERROR` |

Shape de réponse = `ErrorDto { message, code, details? }` (cf. `components.schemas.Error` dans `openapi.yaml`).

---

## 7. Configuration

`application.yml` :

```yaml
server:
  port: ${PORT:3000}
  servlet:
    context-path: /api

spring:
  datasource:
    url: ${DATABASE_URL:jdbc:postgresql://localhost:5432/genial_quizz}
    username: ${POSTGRES_USER:genial}
    password: ${POSTGRES_PASSWORD:genial}
  jpa:
    hibernate:
      ddl-auto: validate
    properties:
      hibernate.dialect: org.hibernate.dialect.PostgreSQLDialect
  flyway:
    enabled: true
    locations: classpath:db/migration

app:
  auth:
    jwt-secret: ${JWT_SECRET}
    jwt-expires-in: ${JWT_EXPIRES_IN:7d}

management:
  endpoints.web.exposure.include: health,info
  endpoint.health.probes.enabled: true
```

**Note** : `DATABASE_URL` vient du compose au format `postgres://user:pass@host:port/db`. Le driver JDBC attend `jdbc:postgresql://host:port/db` — soit changer la valeur dans `.env`, soit parser côté config. Préférer **changer `.env.example`** à `jdbc:postgresql://db:5432/genial_quizz` + `spring.datasource.username` / `password` séparés (plus simple, pas de parsing custom).

---

## 8. Dockerfile (à créer dans le repo backend)

```dockerfile
# syntax=docker/dockerfile:1
FROM eclipse-temurin:21-jdk AS build
WORKDIR /src
COPY . .
RUN ./mvnw -B -DskipTests package

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /src/target/*.jar app.jar
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget -qO- http://localhost:3000/api/actuator/health >/dev/null || exit 1
ENTRYPOINT ["java","-jar","/app/app.jar"]
```

L'image doit être taguée avec ce que `BACKEND_IMAGE` pointe dans `.env`.

---

## 9. Tests

### Pyramide

- **Unitaires (domaine)** : invariants des agrégats, VO, use cases avec ports mockés (Mockito). Pas de Spring, pas de base.
- **Intégration persistance** : `@DataJpaTest` + **Testcontainers** PostgreSQL. Vérifie le round-trip agrégat ↔ JSONB/table.
- **Intégration web** : `@SpringBootTest(webEnvironment = RANDOM_PORT)` + Testcontainers. Tests end-to-end d'un endpoint, sans mock.
- **Sécurité** : test dédié vérifiant qu'un endpoint protégé renvoie 401 sans token, 403 si token valide mais non propriétaire, 200 sinon.

### Cas critiques à couvrir

- Register avec username déjà pris → 409.
- Login bon/mauvais mot de passe.
- Token expiré / signature invalide → 401.
- `GET /quizzes/{id}` public → 200 anonyme ; privé → 403 anonyme, 200 propriétaire, 403 autre user.
- `PUT /quizzes/{id}` par non-propriétaire → 403.
- `QuizInput` avec `questions.length != categories.length` → 400 `INVALID_QUIZ`.
- Round-trip JSONB : un quiz avec les deux types de question + image base64 → save → load → equals.

---

## 10. Plan d'implémentation (ordonné)

1. **Bootstrap du projet**
   - Spring Initializr : Web, Security, Data JPA, Validation, PostgreSQL Driver, Flyway, Actuator.
   - Ajouter `io.jsonwebtoken:jjwt-api/impl/jackson`, `org.testcontainers:postgresql`.
   - Java 21, packaging jar.

2. **Couche domaine** (sans Spring)
   - VO : `UserId`, `Username`, `HashedPassword`, `QuizId`, `PointTier`.
   - Agrégats : `User`, `Quiz` avec leurs invariants.
   - `sealed` `Question` + sous-types.
   - Exceptions métier.

3. **Ports**
   - Inbound : toutes les interfaces `*UseCase` + records de commande.
   - Outbound : `UserRepository`, `QuizRepository`, `PasswordHasher`, `TokenIssuer`, `Clock`.

4. **Application services**
   - `AuthService` implémente les 3 use cases auth — utilise `UserRepository`, `PasswordHasher`, `TokenIssuer`, `Clock`.
   - `QuizService` implémente les 6 use cases quiz — utilise `QuizRepository`, applique la règle de visibilité.
   - Annoter `@Service`, `@Transactional` (readOnly sur les GET/List).

5. **Migrations Flyway**
   - `V1__init.sql` avec les 2 tables + index.

6. **Adaptateurs persistance**
   - `@Entity` + Spring Data repos.
   - `QuizContentJson` POJO + mapping JSONB via `@JdbcTypeCode(SqlTypes.JSON)`.
   - Mappers persistance ↔ domaine.
   - `UserRepositoryAdapter`, `QuizRepositoryAdapter` (`@Component`) implémentant les ports sortants.

7. **Adaptateurs sécurité**
   - `AuthProperties` (`@ConfigurationProperties("app.auth")`).
   - `JwtTokenIssuerAdapter` + `BcryptPasswordHasherAdapter`.
   - `JwtAuthenticationFilter`.
   - `SecurityConfig`.
   - `AuthenticatedUserProvider`.
   - `SystemClockAdapter`.

8. **Adaptateurs web**
   - DTOs + `@JsonTypeInfo` sur `QuestionDto`.
   - Mappers web ↔ domaine.
   - `AuthController`, `QuizController`.
   - `GlobalExceptionHandler`.

9. **Tests**
   - Unitaires domaine (invariants, VO).
   - Unitaires services (ports mockés).
   - `@DataJpaTest` pour les adapters persistance avec Testcontainers.
   - `@SpringBootTest` pour un happy-path complet de chaque endpoint.
   - Sécurité : 401/403 ciblés.

10. **Packaging**
    - `Dockerfile` backend.
    - Publier / build local l'image sous le nom référencé par `BACKEND_IMAGE`.
    - `docker compose up -d` → vérifier healthcheck + un aller-retour frontend ↔ backend.

11. **Smoke test de bout en bout**
    - Depuis le frontend (container) : register → login → créer un quiz → toggle public → logout → charger en anonyme → lancer la partie.

---

## 11. Correspondance OpenAPI ↔ use cases (rappel)

| OpenAPI | HTTP | Controller → Use case |
| --- | --- | --- |
| `/auth/register` POST | 201 | `AuthController.register` → `RegisterUserUseCase` |
| `/auth/login` POST | 200 | `AuthController.login` → `LoginUseCase` |
| `/auth/me` GET | 200 | `AuthController.me` → `GetCurrentUserUseCase` |
| `/quizzes` GET | 200 | `QuizController.listMine` → `ListMyQuizzesUseCase` |
| `/quizzes` POST | 201 | `QuizController.create` → `CreateQuizUseCase` |
| `/quizzes/public` GET | 200 | `QuizController.listPublic` → `ListPublicQuizzesUseCase` |
| `/quizzes/{id}` GET | 200 | `QuizController.get` → `GetQuizUseCase` |
| `/quizzes/{id}` PUT | 200 | `QuizController.update` → `UpdateQuizUseCase` |
| `/quizzes/{id}` DELETE | 204 | `QuizController.delete` → `DeleteQuizUseCase` |

Chaque changement dans `openapi.yaml` doit être répercuté dans les DTOs + mappers web, pas dans le domaine (sauf s'il s'agit d'une règle métier nouvelle).

---

## 12. Évolutions à intégrer (message pour le Claude Code backend)

> Salut. Le frontend vient d'ajouter trois fonctionnalités. Aucune nouvelle table n'est strictement nécessaire si tu fais les bons choix, mais le contrat OpenAPI a changé — `openapi.yaml` à la racine du repo frontend est la source de vérité, regarde-le en priorité avant de coder.

### A. Audio MP3 sur les questions « direct »

- Nouveau champ optionnel `audioUrl` sur `DirectQuestion` uniquement (pas sur `GuessTheMostQuestion`).
- Mêmes règles que `imageUrl` : accepte une URL externe **ou** une data URL `data:audio/...;base64,...` (upload local côté front).
- `maxLength: 5_000_000` (≈ 3,5 Mo en base64).
- Aucun changement de schéma SQL : le champ vit dans le `jsonb content` du quiz. Il faut juste l'ajouter au POJO `QuizContentJson` + au `DirectQuestionDto` (le DTO web) + au record domaine `DirectQuestion`.
- Validation à appliquer dans le domaine ou dans le DTO : si `type == direct` et `audioUrl` présent, vérifier la longueur. Pour `guess_the_most`, refuser ou ignorer un `audioUrl` envoyé (au choix, mais sois cohérent).

### B. Joueurs sauvegardés uniquement pour les quiz privés

- Nouveau champ optionnel `players` sur `QuizDetail` et `QuizInput` : tableau de strings, `maxItems: 6`, chaque item entre 1 et 60 chars.
- Règle métier (à appliquer dans `QuizService` côté application, pas dans le contrôleur) :
  - Si `isPublic == true` à la sauvegarde : **droper** silencieusement le champ `players` (ne pas le stocker, ne pas le renvoyer). Pas de 400, c'est une normalisation.
  - Si `isPublic == false` : persister tel quel.
  - Si on toggle un quiz privé en public via `PUT`, il faut **effacer** les joueurs déjà stockés (donc traiter `players` comme une projection dérivée de `isPublic`, pas comme un champ indépendant).
- Stockage : ajoute `players` dans le `jsonb content` (tu peux mettre `null` ou omettre la clé quand `isPublic`). Pas de nouvelle table.
- Au `GET /quizzes/{id}` :
  - Quiz privé du propriétaire → renvoie `players` si défini.
  - Quiz public → ne renvoie pas le champ (ou `null`).
  - Quiz privé consulté par un autre user → 403 (comportement existant).

### C. Email à l'inscription + flow « mot de passe oublié »

#### Modèle / migration

Ajoute la colonne email sur `users` :

```sql
-- V2__add_user_email.sql
alter table users
    add column email varchar(254);

-- backfill éventuel pour les comptes existants : à toi de voir
-- (placeholder unique, p.ex. concat(username, '@unset.local'))

alter table users
    alter column email set not null,
    add constraint users_email_unique unique (email);

create index idx_users_email_lower on users (lower(email));
```

Ajoute aussi la table des tokens de reset :

```sql
-- V3__password_reset_tokens.sql
create table password_reset_tokens (
    token_hash    varchar(128) primary key,   -- on stocke le SHA-256 hex du token, jamais le token brut
    user_id       uuid         not null references users(id) on delete cascade,
    expires_at    timestamptz  not null,
    consumed_at   timestamptz,                -- non null une fois utilisé
    created_at    timestamptz  not null default now()
);

create index idx_prt_user on password_reset_tokens (user_id);
```

#### Domaine

- `User` gagne un VO `Email` (validation format simple `^[^\s@]+@[^\s@]+\.[^\s@]+$`, `length ≤ 254`, normalisation lowercase à la construction).
- Nouvel agrégat (ou simple entité) `PasswordResetToken` : `tokenHash`, `userId`, `expiresAt`, `consumedAt`.
- Nouveaux ports :
  - `PasswordResetTokenRepository` : `save`, `findValidByTokenHash(String hash, Instant now)`, `markConsumed(String hash, Instant now)`, `deleteExpired(Instant now)`.
  - `EmailSender` : `sendPasswordReset(Email to, String resetUrl, Instant expiresAt)` — implémente-le avec `JavaMailSender` (Spring) ou un faux adapter qui logge en dev.
  - `TokenGenerator` : `String generate()` (32 bytes random base64-url).
- Nouveaux use cases :
  - `RequestPasswordResetUseCase.handle(email)` : ne lève **jamais** d'erreur d'énumération (pas de 404). Si email inconnu → no-op silencieux. Sinon → génère token, stocke `sha256(token)` + `expiresAt = now + 1h`, envoie le mail.
  - `ResetPasswordUseCase.handle(token, newPassword)` : recherche par `sha256(token)`, vérifie non expiré + non consommé, applique le nouveau mot de passe (via `PasswordHasher`), marque le token consommé. Erreurs → `InvalidResetTokenException` → 400.

#### Endpoints (cf. `openapi.yaml` à jour)

| Route | Statut | Notes |
| --- | --- | --- |
| `POST /api/auth/register` | 201 | Body `{ username, email, password }`. 409 si username **ou** email déjà pris. |
| `POST /api/auth/forgot-password` | **204** | Toujours 204 même si l'email est inconnu (anti-énumération). Body `{ email }`. |
| `POST /api/auth/reset-password` | **204** | Body `{ token, password }`. 400 si token invalide / expiré / consommé, ou password trop court. |

Le lien envoyé par email pointe vers le frontend : `https://<host>/reset-password?token=<token>` (le token brut, pas son hash). Configurable via `app.auth.reset-password-url` (défaut `${APP_BASE_URL}/reset-password`). Le frontend a déjà la route `/reset-password` qui lit `?token=...`.

#### Sécurité du flow

- Stocker uniquement le **hash** du token en base (SHA-256 hex). Le token brut n'apparaît que dans le mail.
- Tokens à 32 bytes aléatoires (`SecureRandom`).
- TTL = 1h (configurable via `app.auth.reset-password-ttl`).
- Single use : `consumed_at` non null bloque toute réutilisation.
- Nettoyage périodique des tokens expirés (`@Scheduled` + `deleteExpired`) — pas critique mais propre.
- Rate-limit recommandé sur `/auth/forgot-password` (par IP et/ou par email) pour éviter le spam d'envoi. Pas bloquant pour la livraison initiale.
- Le mail ne doit pas révéler si le compte existe (texte unique côté template).

#### Mapping erreurs

Ajoute dans `GlobalExceptionHandler` :

| Exception | Statut | `code` |
| --- | --- | --- |
| `EmailAlreadyTakenException` | 409 | `EMAIL_TAKEN` |
| `InvalidResetTokenException` | 400 | `INVALID_RESET_TOKEN` |

`UsernameAlreadyTakenException` reste avec `USERNAME_TAKEN`. Si username **et** email sont pris en même temps, lever celle qui correspond au premier conflit détecté.

#### Configuration ajoutée

```yaml
app:
  auth:
    jwt-secret: ${JWT_SECRET}
    jwt-expires-in: ${JWT_EXPIRES_IN:7d}
    reset-password-ttl: ${RESET_PASSWORD_TTL:1h}
    reset-password-url: ${RESET_PASSWORD_URL:http://localhost:5173/reset-password}

spring:
  mail:
    host: ${SMTP_HOST:localhost}
    port: ${SMTP_PORT:1025}
    username: ${SMTP_USER:}
    password: ${SMTP_PASS:}
    properties.mail.smtp.starttls.enable: ${SMTP_STARTTLS:false}
```

En dev, MailHog (`mailhog/mailhog`) sur le port 1025 fait l'affaire et permet de visualiser les mails dans une UI web. À ajouter au `docker-compose.yml` si besoin (service `mailhog`, ports `1025:1025`, `8025:8025`).

### D. Tests à ajouter (en plus de la pyramide existante)

- Unitaire domaine : VO `Email` (valide / invalide / lowercase).
- Unitaire use case : `RequestPasswordResetUseCase` ne lève rien sur email inconnu, mais ne crée pas de token.
- Unitaire use case : `ResetPasswordUseCase` rejette token expiré, token déjà consommé, token inconnu.
- `@DataJpaTest` : round-trip d'un quiz avec `audioUrl` data URL + `players` (privé) + bascule public → players effacés.
- `@SpringBootTest` :
  - `POST /auth/register` avec email déjà pris → 409 `EMAIL_TAKEN`.
  - `POST /auth/forgot-password` avec email inconnu → 204 sans email envoyé (mock le `EmailSender`).
  - `POST /auth/reset-password` happy path puis rejeu du même token → 400.

### E. Points d'attention

- Ne touche pas au format des erreurs (`{ message, code, details? }`), le frontend en dépend.
- Ne renomme pas `players` en autre chose (`playerNames`, `roster`, etc.) — garde le nom utilisé dans `openapi.yaml`.
- Le frontend envoie `players` uniquement quand le quiz est privé, mais sois quand même défensif côté serveur (cas où un client malicieux envoie `players` + `isPublic: true`).
- Tous les nouveaux endpoints sont ouverts (`security: []`). Ajoute-les explicitement dans `SecurityConfig` :

```java
.requestMatchers(HttpMethod.POST, "/api/auth/register",
                                  "/api/auth/login",
                                  "/api/auth/forgot-password",
                                  "/api/auth/reset-password").permitAll()
```

Quand tu as fini, lance le smoke test bout-en-bout du §10.11, plus :
- inscription avec email → reçu en mailhog → reset → relogin avec nouveau mot de passe ;
- création de quiz privé avec joueurs + audio MP3, bascule public → vérifier que `players` disparaît ;
- lecture publique anonyme du quiz → vérifier qu'on entend bien le MP3.

Bon courage.
