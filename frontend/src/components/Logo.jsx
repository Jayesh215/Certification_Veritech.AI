export const Logo = ({ className = "h-9" }) => (
  <img
    src="/veritech-logo.png"
    alt="Veritech.AI"
    className={`${className} w-auto object-contain select-none`}
    draggable="false"
    data-testid="veritech-logo"
  />
);

export default Logo;
