// the @types/novnc__novnc is not working well, define a wrapper ourselves
declare module '@novnc/novnc/lib/rfb' {
  import RFB from '@types/novnc__novnc/lib/rfb';
  export default RFB;
}
