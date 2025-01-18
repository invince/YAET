import {HttpClient} from '@angular/common/http';

export abstract class AbstractFileManager {

  path:string = '/';

  public ajaxSettings: any = {};
  public navigationPaneSettings = this.generateNavigationPaneSettings();
  public contextMenuSettings = this.generateContextMenuSettings();
  public toolbarSettings = this.generateToolbarSettings();

  protected constructor(protected http: HttpClient) {
  }

  abstract generateAjaxSettings(): any;
  abstract getCurrentPath(): string | undefined;



  onFileOpen(args: any): void {
    if (args.fileDetails.isFile) {
      const fileName = args.fileDetails.name;
      const currentPath = this.getCurrentPath(); // Get the current directory path
      const downloadPayload = {
        path: currentPath,
        names: [fileName] // Assuming single file download
      };

      this.downloadFile(downloadPayload);
    }
  }

  downloadFile(payload: any): void {

    if (payload.names) {
      for (const name of payload.names) {
        let path = this.ajaxSettings.openUrl;

        this.http
          .post(path, { downloadInput: JSON.stringify(payload) }, { responseType: 'blob' })
          .subscribe((response: Blob) => {
            // Create a URL for the blob and trigger the download
            const blobUrl = window.URL.createObjectURL(response);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = payload.names[0]; // Set the file name
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(blobUrl); // Cleanup
          });
      }
    }
  }

  protected generateNavigationPaneSettings(): any {
    return {
      visible: true, // Show navigation pane
      maxWidth: '150px', // Set width of the navigation pane
      minWidth: '50px', // Set width of the navigation pane
    };
  }

  // we remove the details button
  protected generateContextMenuSettings(): any {
    return  {
      file: ['Open', '|', 'Cut', 'Copy', 'Paste', 'Delete', 'Rename'],
      folder: ['Open', '|', 'Cut', 'Copy', 'Paste', 'Delete', 'Rename'],
      layout: ['SortBy', 'View', 'Refresh', 'NewFolder', 'Upload', '|', 'SelectAll'],
      visible: true
    };
  }

  // we remove the details button
  protected generateToolbarSettings(): any {
    return {
      items: ['NewFolder', 'Upload', 'Cut', 'Copy', 'Paste', 'Delete', 'Download', 'Rename', 'SortBy', 'Refresh', 'Selection', 'View'],
      visible: true, // Show toolbar
    };
  }

}
