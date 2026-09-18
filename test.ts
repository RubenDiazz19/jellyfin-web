import { PRIMARY_GENRES, ALL_GENRES } from './src/apps/frontend/domain/genres';

const activeOptions = [
    { id: 'Acción' },
    { id: 'Amistad' },
    { id: 'Venganza' },
    { id: 'Batman' },
    { id: 'Drama' },
    { id: 'Comedia' }
];

console.log("Using PRIMARY_GENRES:");
console.log("Genres:", activeOptions.filter(opt => PRIMARY_GENRES.includes(opt.id)));
console.log("Tags:", activeOptions.filter(opt => !PRIMARY_GENRES.includes(opt.id)));

console.log("\nUsing ALL_GENRES:");
console.log("Genres:", activeOptions.filter(opt => ALL_GENRES.includes(opt.id)));
console.log("Tags:", activeOptions.filter(opt => !ALL_GENRES.includes(opt.id)));
