// Fachada de modelos para la capa presentation. La View no importa de data/
// directamente (regla MVVM); tipos y catálogo proto se re-exportan aquí.

export {
    PROTO_DATA,
    findSeason,
    type CarouselSlide,
    type CastMember,
    type Episode,
    type Movie,
    type ProtoData,
    type Rating,
    type Season,
    type Show
} from '../data/models';
