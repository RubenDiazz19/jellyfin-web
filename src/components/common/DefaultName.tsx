import { type FC } from 'react';
import Box from '@mui/material/Box';
import itemHelper from 'components/itemHelper';
import type { ItemDto } from 'types/base/models/item-dto';

interface DefaultNameProps {
    item: ItemDto;
}

const DefaultName: FC<DefaultNameProps> = ({ item }) => {
    const defaultName = itemHelper.getDisplayName(item);
    return (
        <Box className='cardText cardDefaultText'>
            {defaultName}
        </Box>
    );
};

export default DefaultName;
