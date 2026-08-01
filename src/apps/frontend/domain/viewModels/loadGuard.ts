// Guardia de carreras para los ViewModels que cargan de red.
//
// El problema: si el usuario navega y vuelve antes de que termine un `load()`
// anterior, la respuesta lenta llega DESPUÉS de la rápida y sobreescribe
// estado que ya no le corresponde. Cada carga se abre con un token y solo la
// última tiene derecho a escribir.

export class LoadGuard {
    private seq = 0;

    /**
     * Abre una carga y devuelve su test de vigencia: pasa a false en cuanto
     * empieza otra carga posterior. Se consulta después de cada `await`.
     */
    begin(): () => boolean {
        const seq = ++this.seq;
        return () => seq === this.seq;
    }
}
