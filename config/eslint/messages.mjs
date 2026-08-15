/**
 * Por qué no React.FC: no aporta nada que no dé tipar el parámetro de props
 * (el tipo de retorno se infiere), obliga a un genérico para las props, no
 * admite componentes genéricos sin rodeos y arrastra el `children` implícito
 * que React 18 ya quitó, lo que hace que un componente acepte hijos aunque no
 * los pinte. Es también lo que recomiendan los tipos oficiales de React.
 */
export const FC_MESSAGE = 'No uses React.FC: declara el componente como función normal '
    + 'y tipa las props en el parámetro — `function Foo({ a }: Props)`. '
    + 'Si necesita hijos, decláralos en Props (`children: ReactNode`).';
