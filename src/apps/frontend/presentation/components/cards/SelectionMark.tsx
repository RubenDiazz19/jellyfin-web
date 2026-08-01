// La marca de «seleccionado» de una tarjeta: un círculo que se rellena en
// blanco al marcarla. En modo selección sustituye a los botones de la
// carátula —pulsar «visto» o «favorito» dentro de una tarjeta que se está
// marcando es ambiguo— y por eso ocupa su mismo sitio, arriba a la izquierda.

export function SelectionMark({ selected }: { selected: boolean }) {
    return (
        <span style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 22, height: 22, borderRadius: '50%',
            background: selected ? '#fff' : 'rgba(0,0,0,0.45)',
            border: selected ? 'none' : '2px solid rgba(255,255,255,0.7)',
            color: '#000', fontSize: 13, lineHeight: 1
        }}>
            {selected ? '✓' : ''}
        </span>
    );
}
