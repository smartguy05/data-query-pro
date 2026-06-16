import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "data-query-pro";

export const SuggestionCarousel = () => (
  <div className="w-[320px] px-12">
    <Carousel>
      <CarouselContent>
        <CarouselItem>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top revenue regions</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Sum invoice totals grouped by billing region.
            </CardContent>
          </Card>
        </CarouselItem>
        <CarouselItem>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Monthly active users</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Count distinct users per calendar month.
            </CardContent>
          </Card>
        </CarouselItem>
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  </div>
);
