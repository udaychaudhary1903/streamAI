import { CategoriesSection } from "../sections/categories-section";
import { HomeVideosSection } from "../sections/home-videos-section";
import { LivestreamsSection } from "../sections/livestreams-section";

interface HomeViewProps {
    categoryId?: string;
}

export const HomeView = ({ categoryId }: HomeViewProps) => {
    return (
        <div className="max-w-[2400px] mx-auto mb-10 px-4 pt-2.5 flex flex-col gap-y-6">
            {/* Categories + Videos (your existing section) */}
            <CategoriesSection categoryId={categoryId} />
            <HomeVideosSection categoryId={categoryId} />

            {/* Live Now row — only renders when streams are active */}
            <LivestreamsSection categoryId={categoryId} />
        </div>
    );
};