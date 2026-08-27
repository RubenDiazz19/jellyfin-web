import { Progress } from '../controls/Progress';

type Props = {
    value: number;
    height?: number;
    bottom?: number;
};

// Barra de progreso inferior para tarjetas de contenido (pósters, episodios, continuar viendo).
export function CardProgress({ value, height = 3, bottom = 0 }: Props) {
    if (value <= 0) return null;
    return (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom }}>
            <Progress value={value} height={height} />
        </div>
    );
}
