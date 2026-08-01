# Etiquetado automático de la biblioteca

Pone etiquetas **en castellano** a películas y series usando un LLM, eligiendo
de un vocabulario cerrado de ~48 etiquetas.

El problema que resuelve: las `Tags` que Jellyfin baja de TMDB son cientos de
keywords en inglés y de cola larga —`aftercreditsstinger`, `blind girl`,
`chasing dreams`— que como filtro no sirven, porque cada una casa con uno o dos
títulos. Un modelo que genere texto libre reproduce el mismo problema
traducido, así que aquí solo puede elegir de
[`vocabulary.ts`](../../src/apps/frontend/data/autotag/vocabulary.ts).

**No hay ninguna llamada a una IA en tiempo de ejecución.** El script se pasa
una vez, escribe `src/apps/frontend/data/autotag/autoTags.json`, y la app lee
de ese fichero. Si mañana el proveedor desaparece, las etiquetas siguen ahí.

## Puesta en marcha

1. **Clave de Jellyfin** — panel de administración → Avanzado → Claves de API → `+`.
2. **Clave del proveedor** — según cuál elijas:
   - [Groq](https://console.groq.com/keys) (recomendado: capa gratuita amplia y rápido)
   - [Google AI Studio](https://aistudio.google.com/apikey)
   - Ollama: sin clave. `ollama serve` y `ollama pull llama3.1:8b`
3. **Ponerlas en `.env`** (mira `.env.example`):

   ```
   JELLYFIN_API_KEY=…
   AUTOTAG_PROVIDER=groq
   AUTOTAG_API_KEY=…
   ```

4. **Probar con pocos títulos antes de la pasada completa:**

   ```bash
   bun run autotag --dry-run --limit 20
   ```

   `--dry-run` no escribe nada: solo enseña qué etiqueta le pondría a cada uno.
   Es el momento de ajustar el vocabulario si algo no encaja.

5. **Pasada completa:**

   ```bash
   bun run autotag
   ```

## Al añadir contenido nuevo

Vuelve a lanzar el mismo comando:

```bash
bun run autotag
```

**Solo se manda a la IA lo que no estuviera ya etiquetado.** Si añades dos
series a una biblioteca de mil, se mandan esas dos: una llamada, no cincuenta.
Antes de empezar te dice exactamente qué va a hacer:

```
Biblioteca: 5 títulos
Ya etiquetados: 3
Pendientes: 2 en 1 lotes de 10
→ 1 llamadas a la API
```

Para limpiar lo que hayas **borrado** de la biblioteca, añade `--prune`. No
gasta ninguna llamada — es comparar dos listas de ids:

```bash
bun run autotag --prune
```

## Detalles que importan

**Es reanudable.** Guarda después de cada lote y al relanzarlo se salta lo ya
etiquetado. Cortarlo con Ctrl-C, o agotar la cuota diaria de la capa gratuita a
media pasada, no pierde el trabajo hecho: se vuelve a lanzar al día siguiente y
sigue por donde iba.

**Un título puede quedarse sin etiquetas.** Es correcto: al modelo se le pide
explícitamente que devuelva lista vacía antes que forzar una etiqueta dudosa.
Esos títulos se guardan como `[]` para no volver a preguntar por ellos.

**Lo que el modelo se invente se descarta.** Cualquier etiqueta fuera del
vocabulario se cae al validar, y el resumen final las lista. Si ves siempre la
misma inventada, probablemente merezca entrar en el vocabulario.

**Editar el vocabulario es seguro.** El JSON se valida al leerlo, así que
quitar una etiqueta la hace desaparecer de la UI sin regenerar nada. Añadir una
sí obliga a `bun run autotag --force` para que el modelo la considere.

**Los nombres de modelo caducan.** Los proveedores retiran modelos cada pocos
meses. Si sale un 404, mira el listado del proveedor y pon uno vigente en
`AUTOTAG_MODEL`.

## Privacidad

Con `groq`, `gemini` u `openai`, el proveedor ve los títulos y sinopsis de tu
biblioteca (metadatos públicos de TMDB, no tus ficheros). Las capas gratuitas
suelen entrenar con lo que se les manda. Si prefieres que no salga nada de
casa, `AUTOTAG_PROVIDER=ollama` hace exactamente lo mismo en local; tarda más y
la calidad baja algo con modelos de 8B.

## Opciones

```
--dry-run        No escribe; enseña lo que saldría.
--force          Reetiqueta también lo ya etiquetado.
--prune          Borra del fichero lo que ya no está en la biblioteca.
--limit N        Procesa como mucho N títulos.
--only movies    Solo películas (o «series»).
--batch N        Títulos por llamada (por defecto 20).
--delay MS       Espera entre llamadas (por defecto 1500).
```

Si el modelo es pequeño y mezcla títulos del lote, baja `--batch` a 5-10.
