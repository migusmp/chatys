// import { useParams } from "react-router-dom";
import useIsMobile from "../../../../../hooks/useIsMobile";
// import { is } from "date-fns/locale";
import DmRoomMobile from "./DmRoomMobile";
import DmRoomDesktop from "./DmRoomDesktop";

export default function DmRoom() {
    // const { username } = useParams();
    const isMobile = useIsMobile();
    
    return (
        <>
        { isMobile ? (
            <DmRoomMobile />
        ) : (
            <DmRoomDesktop />
        )} 
        </>
         
    );
}