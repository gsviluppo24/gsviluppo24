/**
 * Opzioni disponibili:
 *
 * --env: string - Definisce l'ambiente di deploy - Default: staging
 * --branch: string - Definisce il branch di git - Default: develop
 * --debug: boolean - Se settato, la console stamperà degli elementi di controllo -  Default: false
 * --nodry: boolean - Se settato, effettua il deploy, altrimenti solo prova - Default: false
 * 
 * @author Cyril Dally
 * @data: 2015-09-23
 */

var gulp = require('gulp');
var os   = require('os');
var gulpif = require('gulp-if');
var uglify = require('gulp-uglify');
var minifyCss = require('gulp-minify-css');
var minimist = require('minimist');
var del = require('del');
var fs = require('fs');
var rsync = require('gulp-rsync');
var git = require('gulp-git');
var rename = require('gulp-rename');
var sass = require('gulp-sass');

// Sets the current env and sets the main variables
gulp.task( 'config', function() {

  var hostname = os.hostname();
  if( hostname != 'TRLIVEBUILDER' ) {
    throw "NON SEI SULLA MACCHINA PONTE!\nhostname = " + hostname;
  }
  
  // Recupera le opzioni
  var options = minimist( process.argv.slice( 2 ) );

  // Se non specificato l'env viene settato su develop
  env = undefined == options.env ? 'staging' : options.env;

  // Se non specificato il branch viene settato su develop
  branch = undefined == options.branch ? 'develop' : options.branch;

  if( env == 'production' && branch != 'master' ) {
    throw "NON PUOI DEPLOIARE IN PRODUZIONE DA QUESTO BRANCH!\nenv = " + env + "\nbranch = " + branch;
  }

  // Se non specificato il debug viene settato su false
  debug = undefined == options.debug ? false : true;

  // Se non specificato il nodry viene settato su false
  nodry = undefined == options.nodry ? false : true;

  // Di default il disco di destinazione è settato su quello di dev
  // Non è un'opzione modificabile
  path = 'disco/di/sviluppo/htdocs/';
  
  if( env == "production" ) {

    branch = 'master';
    path = 'disco/di/produzione/htdocs/';

    // Prende le config di prod e crea il file di config .env da deploiare sul server di prod
    fs.createReadStream('.env.prod').pipe( fs.createWriteStream('.env') ); 
  }

  if( debug ) {
    console.log( "Task config: hostname = " + hostname );
    console.log( "Task config: env = " + env );
    console.log( "Task config: branch = " + branch );
    console.log( "Task config: path = " + path );
    console.log( "Task config: nodry = " + nodry );
  }
});


// Pulls the git down
// Depends on config
gulp.task('git-pull', ['config'], function() {

  if( debug ) {
    console.log( "Task git-pull: branch = " + branch );
  }

  // checkout: verificare sintassi
  git.checkout(branch, {}, function (err) {
    if (err) throw err;
  });

  git.pull('origin', branch, {}, function (err) {
    if (err) throw err;
  });
});




// Clean the css dist folder
// Depends on config
gulp.task( 'clean', ['config'], function () {
  return del([ 'css/*']);
});


// Minify all css and copy them to dist folder
// Depends on clean
gulp.task( 'cssmin', ['clean'], function() {

  if( debug ) {
    console.log( "Task cssmin: env = " + env );
  }

  return gulp.src( 'source/css/*.css' )
    .pipe(gulpif( env == "production", minifyCss() )) // only minify in production
    .pipe(gulp.dest('css'));
});

gulp.task('sync', function() {

  var file = fs.readFileSync('rsync-excludelist', "utf8");
  var arr = file.split("\n");

  if( debug ) {
    console.log( "Task sync: arr = " + arr );
  }

  gulp.src( process.cwd() )
    .pipe( gulpif( nodry , rsync( {
        recursive: true,
        // destination: path,
        destination: '../deploy/',
        progress: true,
        incremental: true,
        exclude: arr
      } ) 
    )
  );

});

// Defines the tasks
gulp.task( 'check', [ 'config', 'git-pull' ] );
gulp.task( 'compile', [ 'check', 'clean', 'cssmin' ] );
gulp.task( 'deploy', [ 'compile', 'sync' ] );