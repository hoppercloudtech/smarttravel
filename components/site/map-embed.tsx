export function MapEmbed({ latitude, longitude, name }: { latitude: number; longitude: number; name: string }) {
  const src = `https://www.google.com/maps?q=${latitude},${longitude}&z=15&output=embed`;
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <iframe
        title={`Map showing ${name}`}
        src={src}
        width="100%"
        height="320"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        className="grayscale-[20%]"
      />
    </div>
  );
}
